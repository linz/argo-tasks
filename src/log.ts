import { log } from '@linzjs/tracing';
import { randomBytes } from 'crypto';

import pkgJson from '../package.json';

log.level = 'debug';

export function registerLogger(cfg: { verbose?: boolean }, cmd: { name: string }): void {
  if (cfg.verbose) log.level = 'trace';

  log.setResources({
    'service.name': pkgJson.name + '#' + cmd.name,
    'service.version': pkgJson.version,
  });
}

export const Trace = {
  /** Byte length of the Trace ID /Span ID */
  Bytes: {
    TraceLength: 16,
    TraceDate: 4,
    TraceRandom: 12,
    SpanLength: 8,
  },
  id(): string {
    return Math.floor(Date.now() / 1000).toString(16) + randomBytes(Trace.Bytes.TraceRandom).toString('hex');
  },
  spanId(): string {
    return randomBytes(Trace.Bytes.SpanLength).toString('hex');
  },
};

log.setTrace({ TraceId: Trace.id(), SpanId: Trace.spanId() });

export const logger = log;
