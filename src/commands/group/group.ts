import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals } from 'cmd-ts';

import type { CommandArguments } from '../../__test__/type.util.ts';
import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { isArgo } from '../../utils/argo.ts';
import { config, forceOutput, registerCli, StrList, Url, verbose } from '../common.ts';

/** Chunk an array into a group size
 * @example
 *
 * ```typescript
 * groupItems(["a","b","c"], 2) => [["a","b"], ["c"]
 *```
 */
export function groupItems<T>(items: T[], groupSize: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += groupSize) {
    const current = items.slice(index, index + groupSize);
    output.push(current);
  }
  return output;
}

// /** Normalize an input as either a JSON array or just an array  */
// function loadInput(x: string): string[] {
//   if (x.startsWith('[')) return JSON.parse(x) as string[];
//   return [x];
// }

export const CommandGroupArgs = {
  config,
  verbose,
  forceOutput,
  size: option({
    type: number,
    long: 'size',
    description: 'Group items into this number of items group',
    defaultValue: () => 50,
    defaultValueIsSerializable: true,
  }),
  inputs: restPositionals({
    type: StrList,
    displayName: 'items',
    description: 'list of items to group, can be a JSON array',
  }),
  fromFile: option({
    type: optional(Url),
    long: 'from-file',
    description: 'JSON file to load inputs from, must be a JSON Array',
  }),
};

export const commandGroup = command({
  name: 'group',
  version: CliInfo.version,
  description: 'group a array of inputs into a set ',
  args: CommandGroupArgs,
  async handler(args) {
    registerCli(this, args);

    const inputs: string[] = [];
    inputs.push(...args.inputs.flat()); // Todo: does this need to be flat?

    if (args.fromFile) {
      if (await fsa.exists(args.fromFile)) {
        const input = await fsa.readJson<string[]>(args.fromFile);
        if (Array.isArray(input)) inputs.push(...input);
      }
    }

    if (inputs.length === 0) {
      logger.error('Group:Error:Empty');
      process.exit(1);
    }

    const grouped = groupItems(inputs, args.size);
    logger.info({ files: inputs.length, groups: grouped.length }, 'Group:Done');
    if (args.forceOutput || isArgo()) {
      const items = [];
      // Write out a file per group into /tmp/group/output/000.json
      for (let i = 0; i < grouped.length; i++) {
        const groupId = String(i).padStart(3, '0');
        logger.trace(
          {
            target: `/tmp/group/output/${groupId}.json`,
            groupId: i,
            count: grouped[i]?.length,
          },
          'Group:Output:File',
        );
        await fsa.write(fsa.toUrl(`/tmp/group/output/${groupId}.json`), JSON.stringify(grouped[i], null, 2));
        items.push(groupId);
      }

      // output.json contains ["001","002","003","004","005","006","007"...]
      logger.debug({ target: '/tmp/group/output.json', groups: items }, 'Group:Output');
      await fsa.write(fsa.toUrl('/tmp/group/output.json'), JSON.stringify(items));
    }
  },
});

export type CommandGroupArgs = CommandArguments<typeof commandGroup>;
