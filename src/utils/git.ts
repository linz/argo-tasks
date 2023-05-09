import { execFileSync } from 'child_process';

export const LastGitVersion = { version: 'unknown', hash: 'unknown' };
export function GitVersion(): { version: string; hash: string } {
  if (LastGitVersion.version !== 'unknown') return LastGitVersion;
  try {
    LastGitVersion.hash = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
    LastGitVersion.version = execFileSync('git', ['describe', '--tags', '--always', '--match', 'v*']).toString().trim();
  } catch (e) {}

  return LastGitVersion;
}
