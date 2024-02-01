import { Type } from 'cmd-ts';

import { PathString, UrlString } from './types.js';

export const PathStringOrUrlStringFromString: Type<string, PathString | UrlString> = {
  async from(value) {
    try {
      return new URL(value).href as UrlString;
    } catch (error) {
      return value as PathString;
    }
  },
};
