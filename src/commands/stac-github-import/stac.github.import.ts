import { fsa } from '@chunkd/fs';
import { execFileSync } from 'child_process';
import { Type, command, option, string } from 'cmd-ts';
import path from 'node:path';
import * as st from 'stac-ts';
import { config, registerCli, verbose } from '../common.js';
import { logger } from '../../log.js';

const Url: Type<string, URL> = {
  async from(str) {
    return new URL(str);
  },
};

export const commandStacGithubImport = command({
  name: 'stac-github-import',
  description: 'Format and push a stac collection.json file to GitHub repository',
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

  handler: async (args) => {
    registerCli(args);

    const gitName = process.env['GIT_AUTHOR_NAME'] ?? 'imagery[bot]';
    const gitEmail = process.env['GIT_AUTHOR_EMAIL'] ?? 'imagery@linz.govt.nz';

    const sourceCollection = new URL('collection.json', args.source);
    const targetCollection = new URL('collection.json', args.target);

    const collection = await fsa.readJson<st.StacCatalog>(sourceCollection.href);

    const gitRepo = '/tmp/gitrepo/';
    const collectionPath = path.join(gitRepo, 'stac', targetCollection.pathname);

    // Clone the GitHub repo
    logger.info({ repo: args.repoName }, 'Git:clone');
    execFileSync('git', ['clone', `git@github.com:${args.repoName}`, gitRepo]);
    execFileSync('git', ['config', 'user.email', gitEmail], { cwd: gitRepo });
    execFileSync('git', ['config', 'user.name', gitName], { cwd: gitRepo });

    logger.info({ template: path.join(gitRepo, 'template', 'catalog.json') }, 'Stac:ReadTemplate');
    // Load information from the template inside the repo
    const catalog = await fsa.readJson<st.StacCatalog>(path.join(gitRepo, 'template', 'catalog.json'));
    // Catalog template should have a absolute link to it's self
    const selfLink = catalog.links.find((f) => f.rel === 'self');
    if (selfLink == null) throw new Error('unable to find self link in catalog');

    logger.info({ href: selfLink.href }, 'Stac:SetRoot');

    // Update the root link in the collection to the one defined in the repo template
    const rootLink = collection.links.find((f) => f.rel === 'root');
    if (rootLink) {
      rootLink.href = selfLink.href;
      rootLink.type = 'application/json';
    } else {
      collection.links.unshift({ rel: 'root', href: selfLink.href, type: 'application/json' });
    }

    // Write the file to targetCollection and format it with prettier
    await fsa.write(collectionPath, JSON.stringify(collection));
    logger.info({ repo: gitRepo }, 'npm:install');

    execFileSync('npm', ['install'], { cwd: gitRepo });
    // Format the file with prettier
    execFileSync('npx', ['prettier', '-w', collectionPath], { cwd: gitRepo });
    execFileSync('git', ['add', collectionPath], { cwd: gitRepo });
    logger.info({ path: collectionPath }, 'git:add');

    // branch: "feat/bot-01GYXCC7823GVKF6BJA6K354TR"
    execFileSync('git', ['checkout', '-B', `feat/bot-${collection.id}`], { cwd: gitRepo });
    // commit: "feat: import Manawatū-Whanganui 0.4m Rural Aerial Photos (2010-2011)"
    execFileSync('git', ['commit', '-am', `feat: import ${collection.title}`], { cwd: gitRepo });
    logger.info({ commit: `feat: import ${collection.title}`, branch: `feat/bot-${collection.id}` }, 'git:commit');

    // Push branch
    execFileSync('git', ['push', 'origin', 'HEAD', '--force'], { cwd: gitRepo });
  },
});
