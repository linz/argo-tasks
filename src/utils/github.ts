import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types.js';

import { logger } from '../log.js';

export interface Blob {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
}

export class GithubApi {
  octokit: Api;
  repo: string;
  owner: string;

  constructor(repository: string) {
    const [owner, repo] = repository.split('/');
    if (owner == null || repo == null) throw new Error(`Badly formatted repository name: ${repository}`);
    this.owner = owner;
    this.repo = repo;

    const token = process.env['GITHUB_API_TOKEN'];
    if (token == null) throw new Error(`Please set up GITHUB_API_TOKEN environment variable.`);
    this.octokit = restEndpointMethods(new Octokit({ auth: token }));
  }

  isOk = (s: number): boolean => s >= 200 && s <= 299;
  toRef = (branch: string): string => `heads/${branch}`;

  /**
   * Get branch by name if exists
   */
  async getBranch(branch: string): Promise<string | undefined> {
    logger.debug({ branch }, 'GitHub: Get branch');
    try {
      const response = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: this.toRef(branch),
      });
      if (this.isOk(response.status)) return response.data.object.sha;
    } catch {
      logger.debug({ branch }, 'GitHub: Branch Not Found');
    }
    return;
  }

  /**
   * Create a new branch from the latest master branch
   */
  async createBranch(branch: string): Promise<string> {
    // Get the latest sha from master branch
    const master = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: this.toRef('master'),
    });
    if (!this.isOk(master.status)) throw new Error('Failed to get master head.');
    const sha = master.data.object.sha;

    // Create new branch from the latest master
    logger.debug({ branch }, 'GitHub API: Create branch');
    const response = await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/${this.toRef(branch)}`,
      sha,
    });
    if (!this.isOk(response.status)) throw new Error(`Failed to create branch ${branch}.`);
    return sha;
  }

  /**
   * Create a blob object in git
   */
  async createBlob(content: string, path: string): Promise<Blob> {
    // Create the blobs with the files content
    logger.debug({ path }, 'GitHub API: Create blob');
    const blobRes = await this.octokit.rest.git.createBlob({
      owner: this.owner,
      repo: this.repo,
      content,
      encoding: 'utf-8',
    });
    if (!this.isOk(blobRes.status)) throw new Error(`Failed to create data blob.`);

    const blobSha = blobRes.data.sha;
    return { path, mode: '100644', type: 'blob', sha: blobSha };
  }

  /**
   * Get content from the github repository
   */
  async getContent(path: string): Promise<string> {
    logger.info({ path }, 'GitHub API: Get Content');
    const response = await this.octokit.rest.repos.getContent({ owner: this.owner, repo: this.repo, path });
    if (!this.isOk(response.status)) throw new Error('Failed to get aerial TileSet config.');
    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString();
    } else {
      throw new Error(`Unable to find the content from path ${path}.`);
    }
  }

  /**
   * Create a file imagery config file into basemaps-config/config/imagery and commit
   */
  async createCommit(blobs: Blob[], message: string, botEmail: string, sha: string): Promise<string> {
    // Create a tree which defines the folder structure
    logger.debug({ sha }, 'GitHub API: Create Tree');
    const treeRes = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: sha,
      tree: blobs,
    });
    if (!this.isOk(treeRes.status)) throw new Error(`Failed to create tree.`);

    const treeSha = treeRes.data.sha;

    // Create the commit
    logger.debug({ treeSha }, 'GitHub API: Create Commit');
    const commitRes = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      author: {
        name: 'linz-li-bot',
        email: botEmail,
      },
      parents: [sha],
      tree: treeSha,
    });
    if (!this.isOk(commitRes.status)) throw new Error(`Failed to create commit.`);
    return commitRes.data.sha;
  }

  /**
   * Update the reference of your branch to point to the new commit SHA
   */
  async updateBranch(branch: string, commitSha: string): Promise<void> {
    logger.debug({ branch, commitSha }, 'GitHub API: update ref');
    const response = await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: this.toRef(branch),
      sha: commitSha,
    });
    if (!this.isOk(response.status)) throw new Error(`Failed to update branch ${branch} sha.`);
  }

  /**
   * Create a new pull request from the given branch and return pull request number
   */
  async createPullRequest(branch: string, title: string): Promise<number> {
    // Create pull request from the give head
    const response = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      head: branch,
      base: 'master',
    });
    if (!this.isOk(response.status)) throw new Error('Failed to create pull request.');
    logger.info({ branch, url: response.data.html_url }, 'GitHub: Create Pull Request');
    return response.data.number;
  }
}

export interface GithubFiles {
  path: string;
  content: string;
}

/**
 * Create github pull requests
 *
 * @returns pull request number
 */
export async function createPR(
  gh: GithubApi,
  branch: string,
  title: string,
  botEmail: string,
  files: GithubFiles[],
): Promise<number> {
  // git checkout -b
  logger.info({ branch }, 'GitHub: Get branch');
  let sha = await gh.getBranch(branch);
  if (sha == null) {
    logger.info({ branch }, 'GitHub: branch Not Found, create new branch');
    sha = await gh.createBranch(branch);
  }

  // git add
  const blobs: Blob[] = [];
  for (const file of files) {
    logger.info({ path: file.path }, 'GitHub: Add change');
    const blob = await gh.createBlob(file.content, file.path);
    blobs.push(blob);
  }

  // git commit
  logger.info({ branch }, 'GitHub: Commit to Branch');
  const commitSha = await gh.createCommit(blobs, title, botEmail, sha);

  // git push
  logger.info({ branch }, 'GitHub: Push commit to Branch');
  await gh.updateBranch(branch, commitSha);

  // git pr create
  logger.info({ branch: branch }, 'GitHub: Create Pull Request');
  return await gh.createPullRequest(branch, title);
}
