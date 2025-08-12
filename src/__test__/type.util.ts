export type CommandArguments<C> = C extends { handler: (args: infer A) => unknown } ? A : never;
