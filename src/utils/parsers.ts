import { Type } from 'cmd-ts';
import { pathToFileURL } from 'url';

export const UrlParser: Type<string, URL> = {
  async from(value) {
    try {
      return new URL(value);
    } catch (error) {
      return pathToFileURL(value);
    }
  },
};
