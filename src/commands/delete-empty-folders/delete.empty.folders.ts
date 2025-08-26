import { fsa } from '@chunkd/fs';
import { boolean, command, flag, restPositionals, string } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, verbose } from '../common.ts';

export const CommandListArgs = {
  config,
  verbose,
  dryRun: flag({
    type: boolean,
    defaultValue: () => false,
    long: 'dry-run',
    description: 'Do not perform deletion.',
    defaultValueIsSerializable: true,
  }),
  location: restPositionals({
    type: string,
    displayName: 'location',
    description: 'Path to the empty folders to delete.',
  }),
};

export const commandDeleteEmptyFolders = command({
  name: 'delete-empty-folders',
  version: CliInfo.version,
  description: 'Delete the passed folder and its sub folders if empty.',
  args: CommandListArgs,
  async handler(args) {
    registerCli(this, args);
    const allDeleted: string[] = [];
    for (const l of args.location) {
      const deleted = await deleteEmptyFolders(new URL(l), args.dryRun);
      allDeleted.push(...deleted);
    }
    logger.info({ count: allDeleted.length }, 'DeleteEmptyFolders:Done');
  },
});

/**
 * Delete empty folders recursively.
 * S3 does not have the concept of true folders, but it is possible to simulate a folder using the AWS S3 console for example. In that case, a 0 bytes object with a trailing slash is created to represent the folder (https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-folders.html).
 *
 * @param location The location of the folder to delete.
 * @param dryRun If true, only log the folders that would be deleted.
 * @returns Array of deleted folder paths (as strings)
 */
export async function deleteEmptyFolders(location: URL, dryRun: boolean = true): Promise<string[]> {
  const subs = await fsa.toArray(fsa.list(location.toString(), { recursive: false }));
  if (subs.length === 0) {
    logger.info({ location }, 'DeleteEmptyFolder:NoFolders');
    return [];
  }

  let allEmpty = true;
  const deletedFolders: string[] = [];

  for (const obj of subs) {
    let isFolder = false;

    if (obj.endsWith('/')) {
      const info = await fsa.head(obj);
      if (info?.size === 0) {
        isFolder = true;
      }
    }

    if (isFolder) {
      if (obj === location.toString()) continue;
      const subDeleted = await deleteEmptyFolders(new URL(obj), dryRun);
      deletedFolders.push(...subDeleted);
      if (!subDeleted.includes(obj)) {
        allEmpty = false;
      }
    } else {
      logger.debug({ location: obj }, 'DeleteEmptyFolder:FileFound');
      allEmpty = false;
    }
  }

  if (allEmpty) {
    logger.info({ location }, 'DeleteEmptyFolder:Empty');
    if (!dryRun) {
      await fsa.delete(location.toString());
    }
    deletedFolders.push(location.toString());
  }

  return deletedFolders;
}
