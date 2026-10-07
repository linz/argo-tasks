# GitHub Copilot Project Instructions

This file provides guidelines and instructions for using GitHub Copilot in this project. Amend and maintain this file as needed to help Copilot generate code and documentation that matches this project's standards and requirements.

---

## General Coding Standards

- Follow the TypeScript style defined in `@linzjs/style/tsconfig.base.json`.
- Use ES2022 features as per `tsconfig.json`.
- Prefer functional, modular code.
- Add JSDoc comments for exported functions and classes.
- Use descriptive variable and function names.

## Logging

- Use the `logger` utility for all logging.
- Always log the source file or context when reporting errors.
- Avoid duplicate error logs for the same failure.

## Error Handling

- Throw errors with clear, actionable messages.
- Include relevant context (e.g., file name, operation) in error logs.

## Testing

- Use the `node:test` framework and `assert` for assertions.
- When generating tests, add them to the existing test file for the relevant module.
- Use a new describe block if the function being tested does not already have one.
- Follow existing conventions for test names, structure, and assertions.

## Commit & Branch Naming

- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Example commit: `fix(tileindex-validate): log source file on geo transform error`
- Example branch: `fix/log-tiff-source-on-geo-transform-error-tde-1677`

## Copilot Usage

- When asking Copilot for code, specify:
  - File location
  - Expected input/output
  - Any relevant context or standards
- Review Copilot suggestions for style and correctness before merging.
