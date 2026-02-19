import { fsa } from '@chunkd/fs';

import { logger } from '../../log.ts';

/**
 * Write a single Argo output parameter.
 *
 * Argo expects plain files under /tmp/*
 *
 */
export async function writeOutput(name: string, value: string | undefined): Promise<void> {
  const path = `/tmp/${name}`;
  const url = fsa.toUrl(path);
  const finalValue = value ?? '';

  logger.info(
    {
      name,
      path,
      value: finalValue,
    },
    'ArgoOutput:Write',
  );

  await fsa.write(url, finalValue);
}

/**
 * Write multiple Argo output parameters.
 *
 */
export async function writeOutputs(values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await writeOutput(key, value);
  }
}
