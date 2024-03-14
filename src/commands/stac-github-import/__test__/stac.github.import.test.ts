import { describe, it } from 'node:test';
import { BotEmails, commandStacGithubImport } from '../stac.github.import.js';

describe('commandStacGithubImport.handler', () => {
  it('should call function to create pull request', async (t) => {
    commandStacGithubImport.handler({
      config: '',
      verbose: anyBoolean(),
      source: new URL('s3://anybucket/anypath/'),
      target: new URL('s3://anybucket/anypath/'),
      repoName: anyValidRepoName(),
    })
    
  });
});

function anyBoolean(): boolean {
  return Math.random() >= 0.5;
}

function anyValidRepoName(): string {
  return randomObjectKey(BotEmails);
}

function randomObjectKey(input: Object): string {
  return randomArrayEntry(Object.keys(input))
}

export function randomArrayEntry<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}
