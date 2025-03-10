import { fsa } from '@chunkd/fs';
import type { HelpTopic, ProvidesHelp } from 'cmd-ts/dist/cjs/helpdoc.ts';
import { writeFileSync } from 'fs';
import * as prettier from 'prettier';

import { AllCommands } from '../commands/index.ts';
import { commandHasExample, ExampleSymbol } from './readme.example.ts';
const AnsiRemove = /\u001b\[.*?m/g;

function hasHelp(f: unknown): f is ProvidesHelp {
  if (f == null) return false;
  return typeof (f as ProvidesHelp).helpTopics === 'function';
}

async function generateReadme(): Promise<void> {
  const commandIndex: string[] = [];

  commandIndex.push('|Command|Description|');
  commandIndex.push('|---------|---------|');

  for (const [key, cmd] of Object.entries(AllCommands)) {
    if (key !== cmd.name) {
      console.log(`Command name mismatch ${key} vs "${cmd.name}".. skipping`);
      continue;
    }

    if (!hasHelp(cmd)) {
      console.log(`Command missing help "${cmd.name}".. skipping`);
      continue;
    }

    const targetPath = `./src/commands/${cmd.name}`;
    const stat = await fsa.exists(targetPath);
    if (stat === false) {
      console.log(`Command missing folder ${targetPath}`);
      continue;
    }

    const args: HelpTopic[] = [];
    const options: HelpTopic[] = [];
    const flags: HelpTopic[] = [];

    for (const topic of cmd.helpTopics()) {
      if (topic.category === 'arguments') args.push(topic);
      else if (topic.category === 'options') options.push(topic);
      else if (topic.category === 'flags') flags.push(topic);
      else throw new Error('Unknown help topic: ' + topic.category);
    }

    const data: string[] = [];

    data.push(`# ${cmd.name}`);
    data.push();
    data.push(cmd.description ?? 'No description');
    data.push();
    data.push('## Usage');
    data.push();
    data.push(`${cmd.name} <options> ` + args.map((m) => m.usage).join(' '));

    if (commandHasExample(cmd)) {
      data.push();
      data.push('## Examples');
      for (const example of cmd[ExampleSymbol]) {
        data.push(`#### ${example.title}`);
        data.push();
        data.push(example.text);
      }
    }

    for (const topics of [args, options, flags]) {
      const firstTopic = topics[0]?.category;

      if (firstTopic == null) continue;
      data.push(`### ${firstTopic.charAt(0).toUpperCase()}${firstTopic.slice(1)}`); // upper case flags -> Flags
      data.push();
      data.push('|Usage|Description|Options|');
      data.push('|---------|---------|');
      for (const topic of topics) {
        // all commands have --help
        if (topic.usage.startsWith('--help')) continue;

        const context = [topic.usage, topic.description, topic.defaults?.[0]?.replace(AnsiRemove, '') ?? ''].join('|');
        data.push(`|${context}|`);
      }
    }
    data.push();
    data.push('<!-- This file has been autogenerated by src/readme/readme.generate.ts -->');
    data.push();

    const text = data.join('\n');

    const formatted = await prettier.format(text, { filepath: 'readme.md' });
    const targetReadme = fsa.join(targetPath, 'README.md');

    writeFileSync(targetReadme, formatted);
    const cmdHeader = [`[${cmd.name}](${targetReadme})`, cmd.description].join('|');
    commandIndex.push(`|${cmdHeader}|`);
  }

  const commandText = commandIndex.join('\n');

  const formatted = await prettier.format(commandText, { filepath: 'readme.md' });
  writeFileSync('COMMANDS.md', formatted);
}

generateReadme().catch((e) => console.log('Failed', e));
