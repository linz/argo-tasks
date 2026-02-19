import { fsa } from '@chunkd/fs';
import { command, positional } from 'cmd-ts';

import { CliInfo } from '../../cli.info.ts';
import { logger } from '../../log.ts';
import { config, registerCli, Url, verbose } from '../common.ts';
import { writeOutputs } from './argo.outputs.ts';

type OdrCopyConfig = {
  target_bucket: string;
  target_prefix: string;
  copy_assets_parameters?: string;
};

type CopyAssetsParams = {
  source?: string;
  target?: string;
  ticket?: string;
  copy_option?: string;
  region?: string;
  flatten?: boolean;
};

export const commandParseOdrCopyConfig = command({
  name: 'parse-odr-copy-config',
  description: 'Parse copy-config.json and emit Argo parameters',
  version: CliInfo.version,
  args: {
    config,
    verbose,
    copyConfig: positional({
      type: Url,
      displayName: 'copy-config',
      description: 'Location of copy-config.json',
    }),
  },

  async handler(args) {
    registerCli(this, args);

    const configUrl = new URL(args.copyConfig);
    const baseDir = configUrl.toString().replace(/[^/]+$/, '');
    const odrConfig = await fsa.readJson<OdrCopyConfig>(configUrl);

    // Validate required files
    for (const file of ['catalog.json', 'collection.json']) {
      if (!(await fsa.exists(new URL(file, baseDir)))) {
        throw new Error(`${file} not found in ${baseDir}`);
      }
    }

    const defaultOutputs = {
      target_bucket: odrConfig.target_bucket,
      dataset_path: odrConfig.target_prefix,
      source_assets: '',
      target_assets: '',
      ticket: '',
      copy_option: '',
      region: '',
      flatten: '',
      copy_assets: 'false',
    };

    if (!odrConfig.copy_assets_parameters) {
      logger.info('No copy_assets_parameters specified.');
      await writeOutputs(defaultOutputs);
      return;
    }

    const paramsUrl = new URL(odrConfig.copy_assets_parameters, baseDir);
    const params = await fsa.readJson<CopyAssetsParams>(paramsUrl);

    await writeOutputs({
      ...defaultOutputs,
      source_assets: params.source ?? '',
      target_assets: params.target ?? '',
      ticket: params.ticket ?? '',
      copy_option: params.copy_option ?? '',
      region: params.region ?? '',
      flatten: params.flatten === undefined ? '' : String(params.flatten),
      copy_assets: 'true',
    });
  },
});
