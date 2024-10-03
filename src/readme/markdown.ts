export const md = {
  /**
   * Create a markdown code block
   *
   * @param body body of the code block
   * @param lang language to use eg `bash`
   * @returns markdown formatted code block
   */
  code(lang: 'bash' | 'typescript', body: string): string {
    return `
\`\`\`${lang}
${body}
\`\`\`
`;
  },
};
