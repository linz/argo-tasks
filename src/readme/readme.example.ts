export const ExampleSymbol = Symbol('example-text');

export interface CommandWithExamples {
  [ExampleSymbol]: { title: string; text: string }[];
}

/**
 * Create a markdown code block
 *
 * @param body body of the code block
 * @param lang language to use eg `bash`
 * @returns markdown formatted code block
 */
export function mdCode(lang: 'bash' | 'typescript', body: string): string {
  return `
\`\`\`${lang}
${body}
\`\`\`
`;
}
/**
 * Annotate a command with examples
 *
 * @param cmd Command to annotate
 * @param exampleTitle Title for the example
 * @param exampleText body of the example, markdown is supported
 */
export function annotateExample(cmd: unknown, exampleTitle: string, exampleText: string): void {
  if (cmd == null) throw new Error('Command is null');
  const ce = cmd as CommandWithExamples;
  const examples = ce[ExampleSymbol] ?? [];

  examples.push({ title: exampleTitle, text: exampleText });
  ce[ExampleSymbol] = examples;
}

/**
 * Does the command have examples annotated
 *
 * @see {@link annotateExample}
 *
 * @param cmd
 * @returns whether there are examples
 */
export function commandHasExample<T>(cmd: T): cmd is T & CommandWithExamples {
  if (cmd == null) return false;
  return (cmd as unknown as CommandWithExamples)[ExampleSymbol] != null;
}
