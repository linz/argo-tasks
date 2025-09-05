import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import type { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types.js';

import { logger } from '../log.ts';

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
  async getContent(path: string): Promise<string | null> {
    logger.info({ path }, 'GitHub API: Get Content');
    const response = await this.octokit.rest.repos
      .getContent({ owner: this.owner, repo: this.repo, path })
      .catch((e) => {
        if (isGithubError(e) && e?.status === 404) return null;
        throw e;
      });

    if (response != null && 'content' in response.data) return Buffer.from(response.data.content, 'base64').toString();
    return null;
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
  async createPullRequest(
    branch: string,
    title: string,
    botEmail: string,
    files: GithubFiles[],
    body?: string,
  ): Promise<number | null> {
    // git checkout -b
    logger.info({ branch }, 'GitHub: Get branch');
    let sha = await this.getBranch(branch);
    if (sha == null) {
      logger.info({ branch }, 'GitHub: branch Not Found, create new branch');
      sha = await this.createBranch(branch);
    }

    // git add
    const blobs: Blob[] = [];
    for (const file of files) {
      logger.info({ path: file.path }, 'GitHub: Add change');
      const blob = await this.createBlob(file.content, file.path);
      blobs.push(blob);
    }

    // git commit
    logger.info({ branch }, 'GitHub: Commit to Branch');
    const commitSha = await this.createCommit(blobs, title, botEmail, sha);

    // git push
    logger.info({ branch }, 'GitHub: Push commit to Branch');
    await this.updateBranch(branch, commitSha);

    // git pr create
    logger.info({ branch }, 'GitHub: Create Pull Request');

    // Create pull request from the given head
    const response = await this.octokit.rest.pulls
      .create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head: branch,
        base: 'master',
      })
      .catch((e) => {
        if (isGithubError(e) && e?.status === 422 && String(e.message).includes('A pull request already exists')) {
          logger.info({ branch }, 'A pull request already exists for branch');
          return null;
        }
        throw e;
      });

    if (response != null && this.isOk(response.status)) {
      logger.info({ branch, url: response.data.html_url }, 'GitHub: Create Pull Request');
      return response.data.number;
    }
    return null;
  }
}

export interface GithubFiles {
  path: string;
  content: string;
}

interface GithubError {
  status?: number;
  message?: string;
}

/**
 * This a typechecker work around to allow `.catch(e)` to cast `e` easily as a `GithubError`
 */
function isGithubError(e: unknown): e is GithubError {
  return e != null;
}
