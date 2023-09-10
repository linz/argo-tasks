import { Env, LogType } from '@basemaps/shared';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types.js';

export interface Job {
  imagery: string;
  tileMatrix: string;
  content: string;
}

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
  logger: LogType;

  constructor(repository: string, logger: LogType) {
    this.logger = logger;
    const [owner, repo] = repository.split('/');
    if (owner == null || repo == null) throw new Error(`Badly formatted repository name: ${repository}`);
    this.owner = owner;
    this.repo = repo;

    const token = Env.get(Env.GitHubToken);
    if (token == null) throw new Error('Please set up github token environment variable.');
    this.octokit = restEndpointMethods(new Octokit({ auth: token }));
  }

  isOk = (s: number): boolean => s >= 200 && s <= 299;
  isNotFound = (s: number): boolean => s === 404;
  toRef = (branch: string): string => `heads/${branch}`;

  /**
   * Get branch by name if exists
   */
  async getBranch(branch: string): Promise<string | undefined> {
    this.logger.debug({ branch }, 'GitHub: Get branch');
    try {
      const response = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: this.toRef(branch),
      });
      if (this.isOk(response.status)) return response.data.object.sha;
    } catch {
      this.logger.debug({ branch }, 'GitHub: Branch Not Found');
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
    this.logger.debug({ branch }, 'GitHub API: Create branch');
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
  async createBlobs(content: string, path: string): Promise<Blob> {
    // Create the blobs with the files content
    this.logger.debug({ path }, 'GitHub API: Create blob');
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
    this.logger.info({ path }, 'GitHub API: Get Content');
    const response = await this.octokit.rest.repos.getContent({ owner: this.owner, repo: this.repo, path });
    if (!this.isOk(response.status)) throw new Error('Failed to get aerial TileSet config.');
    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString();
    } else {
      throw new Error('Unable to find the content.');
    }
  }

  /**
   * Create a file imagery config file into basemaps-config/config/imagery and commit
   */
  async createCommit(blobs: Blob[], message: string, sha: string): Promise<string> {
    // Create a tree which defines the folder structure
    this.logger.debug({ sha }, 'GitHub API: Create Tree');
    const treeRes = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: sha,
      tree: blobs,
    });
    if (!this.isOk(treeRes.status)) throw new Error(`Failed to create tree.`);

    const treeSha = treeRes.data.sha;

    // Create the commit
    this.logger.debug({ treeSha }, 'GitHub API: Create Commit');
    const commitRes = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
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
    this.logger.debug({ branch, commitSha }, 'GitHub API: update ref');
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
    this.logger.info({ branch, url: response.data.html_url }, 'GitHub: Create Pull Request');
    return response.data.number;
  }
}

export class Github extends GithubApi {
  blobs: Blob[] = [];
  sha: string | undefined;
  commitSha: string | undefined;
  branch: string | undefined;

  constructor(repository: string, logger: LogType) {
    super(repository, logger);
  }

  /**
   * git checkout -b
   */
  async checkout(branch: string): Promise<void> {
    this.logger.info({ branch }, 'GitHub: Get branch');
    const sha = await this.getBranch(branch);
    if (sha == null) {
      this.logger.info({ branch }, 'GitHub: branch Not Found, create new branch');
      this.sha = await this.createBranch(branch);
    } else this.sha = sha;
    this.branch = branch;
  }

  /**
   * git add
   */
  async add(content: string, path: string): Promise<void> {
    this.logger.info({ path }, 'GitHub: Add change');
    if (this.sha == null) throw new Error('Please checkout new branch first');
    const blob = await this.createBlobs(content, path);
    this.blobs.push(blob);
  }

  /**
   * git commit
   */
  async commit(message: string): Promise<void> {
    this.logger.info({ branch: this.branch }, 'GitHub: Commit to Branch');
    if (this.sha == null) throw new Error('Please checkout new branch first');
    if (this.blobs.length === 0) throw new Error('Please add changes before commit');
    this.commitSha = await this.createCommit(this.blobs, message, this.sha);
    this.blobs = [];
  }

  /**
   * git push
   */
  async push(): Promise<void> {
    this.logger.info({ branch: this.branch }, 'GitHub: Push commit to Brach');
    if (this.branch == null) throw new Error('Please checkout branch first');
    if (this.commitSha == null) throw new Error('Please commit changes first');
    await this.updateBranch(this.branch, this.commitSha);
  }

  /**
   * git pr create
   */
  async prCreate(title: string): Promise<number> {
    this.logger.info({ branch: this.branch }, 'GitHub: Create Pull Request');
    if (this.branch == null) throw new Error('Please checkout branch first');
    return await this.createPullRequest(this.branch, title);
  }
}
