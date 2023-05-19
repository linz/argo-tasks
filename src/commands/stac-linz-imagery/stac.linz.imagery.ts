import { fsa } from '@chunkd/fs';
import { command, option, string } from 'cmd-ts';
import * as st from 'stac-ts';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { execFileSync } from 'child_process';

/** is a path a URL */
export function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch (e) {
    return false;
  }
}

export const commandStacLinzImagery = command({
  name: 'stac-linz-imagery',
  description: 'Format and push a linz-imagery collection.json file to GitHub',
  args: {
    config,
    verbose,
    source: option({
      type: string,
      long: 'source',
      description: 'Source location of the collection.json file',
    }),
    target: option({
      type: string,
      long: 'target',
      description: 'Target location for the collection.json file',
    }),
  },

  handler: async (args) => {
    registerCli(args);
    logger.info('StacCollectionCreation:Start');

    // example source: s3://linz-workflow-artifacts/2023-04/25-ispi-manawatu-whanganui-2010-2011-0-4m-tttsb/flat/
    // example target s3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2010-2011_0.4m/rgb/2193/

    // const gitName = process.env['GIT_AUTHOR_NAME'] ?? 'Imagery[bot]';
    // const gitEmail = process.env['GIT_AUTHOR_EMAIL'] ?? 'imagery@linz.govt.nz';

    const gitName = 'Imagery[bot]';
    const gitEmail = 'placeholder@linz.govt.nz';

    const gitRepo = '/tmp/gitrepo/imagery/';
    const sourceUrl = new URL(args.source);
    const targetUrl = new URL(args.target);
    const sourceCollection = `${sourceUrl.href.replace(/\/+$/, '')}/collection.json`;
    const targetCollection = `${gitRepo}stac${targetUrl.pathname.replace(/\/+$/, '')}/collection.json`;
    const targetPathParts = targetUrl.pathname.split('/');
    const gitBranch = `feat(${targetPathParts[1]})/${targetPathParts[2]}`;
    const gitCommitMsg = `feat(${targetPathParts[1]}): ${targetPathParts[2]}`;

    // Clone the GitHub repo
    // logger.info({ repository: gitRepo }, 'Git: Clone');
    execFileSync('git', ['clone', 'git@github.com:linz/imagery-test', gitRepo]).toString().trim();
    // Configure the GitHub repo
    // logger.info({ repository: gitRepo }, 'Git: Configure User Email');
    execFileSync('git', ['config', 'user.email', gitEmail], { cwd: gitRepo }).toString().trim();
    // logger.info({ repository: gitRepo }, 'Git: Configure User Name');
    execFileSync('git', ['config', 'user.name', gitName], { cwd: gitRepo }).toString().trim();

    const collection = await fsa.readJson<st.StacCatalog>(sourceCollection);

    // Check if the links include a root link, delete and re-add or add

    //         {
    //             "rel": "root",
    //             "href": "https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json",
    //             "type": "application/json",
    //         },

    // Write the file to targetCollection

    // Checkout branch
    // logger.info({ repository: gitRepo }, 'Git: Checkout Branch');
    execFileSync('git', ['checkout', '-b', gitBranch], { cwd: gitRepo }).toString().trim();
    // Add and commit
    // logger.info({ repository: gitRepo }, 'Git: Add and Commit');
    execFileSync('git', ['commit', '-am', gitCommitMsg], { cwd: gitRepo }).toString().trim();
    // Push branch
    // logger.info({ repository: gitRepo }, 'Git: Push Branch to GitHub');
    execFileSync('git', ['push', 'origin', 'HEAD'], { cwd: gitRepo }).toString().trim();
  },
});
