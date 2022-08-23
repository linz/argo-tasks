import { option, optional, string } from 'cmd-ts';

export const config = option({
  long: 'config',
  description: 'Location of role configuration file',
  type: optional(string),
});
