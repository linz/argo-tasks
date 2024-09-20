# stac-github-import

Format and push a STAC collection.json file and Argo Workflows parameters file to a GitHub repository

## Usage

stac-github-import <options>

### Options

| Usage                 | Description                                            | Options               |
| --------------------- | ------------------------------------------------------ | --------------------- |
| --config <str>        | Location of role configuration file                    | optional              |
| --source <value>      | Source location of the collection.json file            |                       |
| --target <value>      | Target location for the collection.json file           |                       |
| --repo-name <value>   | One of 'linz/elevation', 'linz/imagery'                | default: linz/imagery |
| --copy-option <value> | One of '--force', '--no-clobber', '--force-no-clobber' | default: --no-clobber |
| --ticket <str>        | Associated JIRA ticket e.g. AIP-74                     | default:              |

### Flags

| Usage     | Description     | Options |
| --------- | --------------- | ------- |
| --verbose | Verbose logging |         |
