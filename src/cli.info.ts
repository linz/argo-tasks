export const CliInfo = {
  package: '@linzjs/argo-tasks',
  // Git version information
  version: process.env['GIT_VERSION'],
  // Git commit hash
  hash: process.env['GIT_HASH'],
  // Github action that the CLI was built from
  runId: process.env['GITHUB_RUN_ID'],
};
