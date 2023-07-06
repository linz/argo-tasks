import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';
import { logger } from '../../log.js';
import { isArgo } from '../../utils/argo.js';
import { config, forceOutput, registerCli, verbose } from '../common.js';

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

/** Normalize an input as either a JSON array or just an array  */
function loadInput(x: string): string[] {
  if (x.startsWith('[')) return JSON.parse(x);
  return [x];
}

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
    type: string,
    displayName: 'items',
    description: 'list of items to group, can be a JSON array',
  }),
  fromFile: option({
    type: optional(string),
    long: 'from-file',
    description: 'JSON file to load files from',
  }),
};

export const commandGroup = command({
  name: 'group',
  description: 'group a array of inputs into a set ',
  args: CommandGroupArgs,
  handler: async (args) => {
    registerCli(args);

    const inputs: unknown[] = [];
    for (const input of args.inputs) inputs.push(...loadInput(input));
    if (args.fromFile && (await fsa.exists(args.fromFile))) {
      const input = await fsa.readJson(args.fromFile);
      if (Array.isArray(input)) inputs.push(...input);
    }

    if (inputs.length === 0) {
      logger.error('Group:Error:Empty');
      process.exit(1);
    }

    const grouped = groupItems(inputs, args.size);
    logger.info({ files: inputs.length, groups: grouped.length }, 'Group:Done');
    if (args.forceOutput || isArgo()) {
      await fsa.write('/tmp/group/output.json', JSON.stringify(grouped));
    }
  },
});
