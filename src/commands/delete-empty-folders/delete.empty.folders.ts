import { fsa } from '@chunkd/fs';
import { boolean, command, flag, restPositionals } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, UrlFolderList, verbose } from '../common.ts';

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
    type: UrlFolderList,
    displayName: 'location',
    description: 'Location to the empty folders to delete.',
  }),
};

export const commandDeleteEmptyFolders = command({
  name: 'delete-empty-folders',
  version: CliInfo.version,
  description: 'Delete the passed folder and its sub folders if empty.',
  args: CommandListArgs,
  async handler(args) {
    registerCli(this, args);
    const allDeleted: URL[] = [];
    for (const l of args.location.flat()) {
      const deleted = await deleteEmptyFolders(l, args.dryRun);
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
export async function deleteEmptyFolders(location: URL, dryRun: boolean = true): Promise<URL[]> {
  const subs = await fsa.toArray(fsa.list(location, { recursive: false }));
  if (subs.length === 0) {
    logger.info({ location }, 'DeleteEmptyFolder:NoFolders');
    return [];
  }

  let allEmpty = true;
  const deletedFolders: URL[] = [];

  for (const obj of subs) {
    if (await isFolder(obj)) {
      if (obj.href === location.href) continue;
      const subDeleted = await deleteEmptyFolders(obj, dryRun);
      deletedFolders.push(...subDeleted);
      // if (subDeleted.some((item) => item.href === obj.href)) {
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
      await fsa.delete(location);
    }
    deletedFolders.push(location);
  }

  return deletedFolders;
}

/**
 * Check if a location is a folder.
 *
 * @param location The location to check.
 * @returns True if the location is a folder, false otherwise.
 */
export async function isFolder(location: URL): Promise<boolean> {
  if (location.pathname.endsWith('/')) {
    const info = await fsa.head(location);
    if (info?.size === 0) {
      return true;
    }
  }
  return false;
}
