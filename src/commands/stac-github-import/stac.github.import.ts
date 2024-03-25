import { fsa } from '@chunkd/fs';
import { command, oneOf, option, string, Type } from 'cmd-ts';
import * as st from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { GithubApi } from '../../utils/github.js';
import { config, registerCli, verbose } from '../common.js';
import { prettyPrint } from '../format/pretty.print.js';

const Url: Type<string, URL> = {
  async from(str) {
    return new URL(str);
  },
};

const imageryRepo = 'linz/imagery';

/**
 * Valid repositories, mapped to the email address used for the PR author
 */
export const BotEmails: Record<string, string> = {
  'linz/elevation': 'elevation@linz.govt.nz',
  [imageryRepo]: 'imagery@linz.govt.nz',
};

export const commandStacGithubImport = command({
  name: 'stac-github-import',
  description: 'Format and push a STAC collection.json file and Argo Workflows parameters file to a GitHub repository',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    //example: s3://linz-workflow-artifacts/2023-04/25-ispi-manawatu-whanganui-2010-2011-0-4m-tttsb/flat/
    source: option({
      type: Url,
      long: 'source',
      description: 'Source location of the collection.json file',
    }),
    // example: s3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2010-2011_0.4m/rgb/2193/
    target: option({
      type: Url,
      long: 'target',
      description: 'Target location for the collection.json file',
    }),
    repoName: option({
      type: oneOf(Object.keys(BotEmails)),
      long: 'repo-name',
      defaultValue: () => imageryRepo,
      defaultValueIsSerializable: true,
    }),
    copyOption: option({
      type: oneOf(['--force', '--no-clobber', '--force-no-clobber']),
      long: 'copy-option',
      defaultValue: () => '--no-clobber',
      defaultValueIsSerializable: true,
    }),
    ticket: option({
      type: string,
      long: 'ticket',
      description: 'Associated JIRA ticket e.g. AIP-74',
      defaultValue: () => '',
      defaultValueIsSerializable: true,
    }),
  },

  async handler(args) {
    registerCli(this, args);

    const gh = new GithubApi(args.repoName);

    const botEmail = BotEmails[args.repoName];
    if (botEmail == null) throw new Error(`${args.repoName} is not a valid GitHub repository`);

    const basemapsConfigLinkURL = new URL('config-url', args.source);
    // TODO When Basemaps supports Elevation config as part of the standardising workflow, remove this try catch block
    // https://toitutewhenua.atlassian.net/browse/BM-985
    let prBody;
    try {
      const basemapsConfigLink = await fsa.read(basemapsConfigLinkURL.href);
      prBody = `**Basemaps preview link for Visual QA:**\n${basemapsConfigLink}\n\n**ODR destination path:**\n${args.target}`;
    } catch (e) {
      if (args.repoName === imageryRepo) {
        throw e;
      }
      prBody = `**ODR destination path:**\n${args.target}`;
    }

    // Load information from the template inside the repo
    logger.info({ template: fsa.joinAll('template', 'catalog.json') }, 'Stac:ReadTemplate');
    const catalogPath = fsa.joinAll('template', 'catalog.json');
    const catalog = await gh.getContent(catalogPath);
    const catalogJson = JSON.parse(catalog) as st.StacCatalog;

    // Catalog template should have a absolute link to itself
    const selfLink = catalogJson.links.find((f) => f.rel === 'self');
    if (selfLink == null) throw new Error('unable to find self link in catalog');
    logger.info({ href: selfLink.href }, 'Stac:SetRoot');
    // Update the root link in the collection to the one defined in the repo template

    const sourceCollection = new URL('collection.json', args.source);
    const targetCollection = new URL('collection.json', args.target);
    const targetCollectionPath = fsa.joinAll('stac', targetCollection.pathname);

    const collection = await fsa.readJson<st.StacCollection>(sourceCollection.href);

    const rootLink = collection.links.find((f) => f.rel === 'root');
    if (rootLink) {
      rootLink.href = selfLink.href;
      rootLink.type = 'application/json';
    } else {
      collection.links.unshift({ rel: 'root', href: selfLink.href, type: 'application/json' });
    }
    sortLinks(collection.links);

    // branch: "feat/bot-01GYXCC7823GVKF6BJA6K354TR"
    const branch = `feat/bot-${collection.id}`;
    // commit and pull request title: "feat: import Manawatū-Whanganui 0.4m Rural Aerial Photos (2010-2011)"
    const title = `feat: import ${collection.title}`;
    const collectionFileContent = await prettyPrint(JSON.stringify(collection), DEFAULT_PRETTIER_FORMAT);
    const collectionFile = { path: targetCollectionPath, content: collectionFileContent };
    const parametersFileContent = {
      source: args.source,
      target: args.target,
      ticket: args.ticket,
      copy_option: args.copyOption,
      region: collection['linz:region'],
    };
    const parametersFile = {
      path: `publish-odr-parameters/${collection.id}-${Date.now()}.yaml`,
      content: JSON.stringify(parametersFileContent, null, 2),
    };
    logger.info({ commit: `feat: import ${collection.title}`, branch: `feat/bot-${collection.id}` }, 'Git:Commit');
    // create pull request
    await gh.createPullRequest(branch, title, botEmail, [collectionFile, parametersFile], prBody);
  },
});

/** All other rel's are set between "root" and "item" */
const RelPriorityDefault = 50;
/** Ensure root rel are put before everything else */
const RelPriority: Record<string, number> = {
  root: 0,
  item: 100,
};

/** Sort collection links keeping non items at the top then items sorted by href */
export function sortLinks(links: st.StacLink[]): void {
  links.sort((a, b) => {
    if (a.rel === b.rel) return a.href.localeCompare(b.href);
    const aRel = RelPriority[a.rel] ?? RelPriorityDefault;
    const bRel = RelPriority[b.rel] ?? RelPriorityDefault;
    if (aRel === bRel) return a.href.localeCompare(b.href);
    return aRel - bRel;
  });
}
