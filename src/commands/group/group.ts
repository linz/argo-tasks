import { fsa } from '@chunkd/fs';
import { command, number, option, optional, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { isArgo } from '../../utils/argo.ts';
import { chunkItems } from '../../utils/chunk.ts';
import { protocolAwareString } from '../../utils/filelist.ts';
import type { CommandArguments } from '../../utils/type.util.ts';
import { config, forceOutput, parseSize, registerCli, StrList, Url, verbose } from '../common.ts';

/** Input file locations of a tile-index-validate item `{ output, input: string[] }`, empty for any other item */
function itemInputs(item: unknown): URL[] {
  const input = (item as { input?: unknown } | null)?.input;
  return Array.isArray(input) ? input.map((f) => fsa.toUrl(String(f))) : [];
}

/**
 * Look up file sizes with one non-recursive listing per folder, instead of one HEAD per file
 *
 * @returns size in bytes by URL href, files that are not found are missing
 */
export async function getFileSizes(files: URL[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const folders = new Set(files.map((f) => new URL('./', f).href));
  for (const folder of folders) {
    const location = new URL(folder);
    logger.debug({ location: protocolAwareString(location) }, 'Group:List');
    for await (const file of fsa.details(location, { recursive: false })) {
      if (file.size != null) sizes.set(file.url.href, file.size);
    }
  }
  return sizes;
}

/** Total input file size of each tile-index-validate item, 0 for any other item */
export async function getItemSizes(items: unknown[]): Promise<number[]> {
  const inputs = items.map(itemInputs);
  const sizes = await getFileSizes(inputs.flat());

  let missing = 0;
  const itemSizes = inputs.map((files) => {
    let size = 0;
    for (const file of files) {
      const fileSize = sizes.get(file.href);
      if (fileSize == null) missing++;
      else size += fileSize;
    }
    return size;
  });
  const totalSize = itemSizes.reduce((total, size) => total + size, 0);
  logger.info({ items: items.length, totalSize, missing }, 'Group:Size');
  if (missing > 0) logger.warn({ missing }, 'Group:Size:Missing');
  return itemSizes;
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
  groupSize: option({
    type: optional(string),
    long: 'group-size',
    description:
      'Also close a group once its input files reach this total size, eg "100Gi". Items must be tile-index-validate entries ({"input": [...]})',
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
    inputs.push(...args.inputs.flat());

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

    const maxSize = args.groupSize ? parseSize(args.groupSize) : undefined;
    const sizes = maxSize ? await getItemSizes(inputs) : [];
    const grouped = chunkItems(inputs, args.size, maxSize, (_, i) => sizes[i]);
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
