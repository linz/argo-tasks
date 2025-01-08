import * as ulid from 'ulid';

export const CliInfo = {
  package: '@linzjs/argo-tasks',
  // Git version information
  version: process.env['GIT_VERSION'],
  // Git commit hash
  hash: process.env['GIT_HASH'],
  // Github action that the CLI was built from
  buildId: process.env['GITHUB_RUN_ID'] ? `${process.env['GITHUB_RUN_ID']}-${process.env['GITHUB_RUN_ATTEMPT']}` : '',
};

/** Unique Id for this instance of the cli being run */
export const CliId = ulid.ulid();
