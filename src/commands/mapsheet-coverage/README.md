# mapsheet-coverage

Create a list of mapsheets needing to be created from a basemaps configuration

## Usage

mapsheet-coverage <options>

### Options

| Usage                | Description                                                  | Options                                                                                              |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| --config <str>       | Location of role configuration file                          | optional                                                                                             |
| --epsg-code <number> | Basemaps configuration layer ESPG code to use                | default: 2193                                                                                        |
| --location <value>   | Location of the basemaps configuration file                  | default: https://raw.githubusercontent.com/linz/basemaps-config/master/config/tileset/elevation.json |
| --mapsheet <str>     | Limit the output to a specific mapsheet eg "BX01"            | optional                                                                                             |
| --compare <str>      | Compare the output with an existing combined collection.json | optional                                                                                             |
| --output <value>     | Where to store output files                                  | default: file:///tmp/mapsheet-coverage/                                                              |

### Flags

| Usage     | Description     | Options |
| --------- | --------------- | ------- |
| --verbose | Verbose logging |         |

<!-- This file has been autogenerated by src/readme.generate.ts -->