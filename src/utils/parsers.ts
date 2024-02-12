import { fsa } from '@chunkd/fs';
import { Type } from 'cmd-ts';

export const UrlParser: Type<string, URL> = {
  async from(value) {
    return fsa.toUrl(value);
  },
};
