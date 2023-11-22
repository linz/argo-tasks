import path from 'node:path';

import { fsa } from '@chunkd/fs';
import { execFileSync } from 'child_process';
import { command, option, string, Type } from 'cmd-ts';
import * as st from 'stac-ts';

import { CliInfo } from '../../cli.info.js';
import { logger } from '../../log.js';
import { DEFAULT_PRETTIER_FORMAT } from '../../utils/config.js';
import { config, registerCli, verbose } from '../common.js';
import { prettyPrint } from '../format/pretty.print.js';
import { createPR, GithubApi } from '../basemaps-github/github.js';

const Url: Type<string, URL> = {
  async from(str) {
    return new URL(str);
  },
};

export const commandStacGithubImport = command({
  name: 'stac-github-import',
  description: 'Format and push a stac collection.json file to GitHub repository',
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
      type: string,
      long: 'repo-name',
      description: 'Repository name either linz/imagery or linz/elevation',
      defaultValue: () => 'linz/imagery',
      defaultValueIsSerializable: true,
    }),
  },

  async handler(args) {
    registerCli(this, args);

    // 00000000000000000000000000000000000000000000000000000000000000000

    // const gitName = process.env['GIT_AUTHOR_NAME'] ?? 'imagery[bot]';
    // const gitEmail = process.env['GIT_AUTHOR_EMAIL'] ?? 'imagery@linz.govt.nz';


  




    // Write the file to targetCollection

    execFileSync('git', ['add', collectionPath], { cwd: gitRepo });
    logger.info({ path: collectionPath }, 'git:add');

    // branch: "feat/bot-01GYXCC7823GVKF6BJA6K354TR"
    execFileSync('git', ['checkout', '-B', `feat/bot-${collection.id}`], { cwd: gitRepo });
    // commit: "feat: import Manawatū-Whanganui 0.4m Rural Aerial Photos (2010-2011)"
    execFileSync('git', ['commit', '-am', `feat: import ${collection.title}`], { cwd: gitRepo });
    logger.info({ commit: `feat: import ${collection.title}`, branch: `feat/bot-${collection.id}` }, 'git:commit');

    // Push branch
    execFileSync('git', ['push', 'origin', 'HEAD', '--force'], { cwd: gitRepo });

    // 00000000000000000000000000000000000000000000000000000000000000000

    const gh = new GithubApi(args.repoName);
    const branch = `feat/bot-${collection.id}`;
    const title = `feat: import ${collection.title}`;
    // Load information from the template inside the repo
    logger.info({ template: path.join(gitRepo, 'template', 'catalog.json') }, 'Stac:ReadTemplate');
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

    const collection = await fsa.readJson<st.StacCollection>(sourceCollection.href);
    const collectionPath = path.join('stac', targetCollection.pathname);

    const rootLink = collection.links.find((f) => f.rel === 'root');
    if (rootLink) {
      rootLink.href = selfLink.href;
      rootLink.type = 'application/json';
    } else {
      collection.links.unshift({ rel: 'root', href: selfLink.href, type: 'application/json' });
    }

    sortLinks(collection.links);

    // this will need to be a string
    // await fsa.write(collectionPath, await prettyPrint(JSON.stringify(collection), DEFAULT_PRETTIER_FORMAT));

    // pass the file content as a string
    // await createPR(gh, branch, title, [file]);

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
