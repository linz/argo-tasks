import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import * as st from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { createPR, GithubApi } from '../../utils/github.js';
import { config, registerCli, verbose } from '../common.js';
import { prettyPrint } from '../format/pretty.print.js';
import {UrlParser} from "../../utils/parsers.js";

export const commandStacGithubImport = command({
  name: 'stac-github-import',
  description: 'Format and push a stac collection.json file to GitHub repository',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    //example: s3://linz-workflow-artifacts/2023-04/25-ispi-manawatu-whanganui-2010-2011-0-4m-tttsb/flat/
    source: option({
      type: UrlParser,
      long: 'source',
      description: 'Source location of the collection.json file',
    }),
    // example: s3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2010-2011_0.4m/rgb/2193/
    target: option({
      type: UrlParser,
      long: 'target',
      description: 'Target location for the collection.json file',
    }),
    repoName: option({
      type: string,
      long: 'repo-name',
      description: 'Repository name either linz/imagery or linz/elevation',
      defaultValue: () => 'linz/imagery',
      defaultValueIsSerializable: true,
    }),
  },

  async handler(args) {
    registerCli(this, args);

    const gh = new GithubApi(args.repoName);

    const BotEmails: Record<string, string> = {
      'linz/elevation': 'elevation@linz.govt.nz',
      'linz/imagery': 'imagery@linz.govt.nz',
    };

    const botEmail = BotEmails[args.repoName];
    if (botEmail == null) throw new Error(`${args.repoName} is not a valid GitHub repository`);

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
    logger.info({ commit: `feat: import ${collection.title}`, branch: `feat/bot-${collection.id}` }, 'Git:Commit');
    // create pull request
    await createPR(gh, branch, title, botEmail, [collectionFile]);
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
