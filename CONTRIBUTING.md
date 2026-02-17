# Contributing to Triumvirate

We welcome contributions to Triumvirate! Whether it's bug reports, feature requests, documentation improvements, or code contributions, your help is appreciated.

## Development Setup

1.  **Prerequisites:**
    *   Node.js >= 20
    *   npm (comes with Node.js)
    *   Git
2.  **Clone the repository:**
    ```bash
    git clone https://github.com/closedloop-technologies/triumvirate.git
    cd triumvirate
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Run in development mode:**
    Use `tsx` to run the TypeScript source directly:
    ```bash
    npm run dev -- review --models openai --output dev-output.json
    ```
    Alternatively, build the project first (`npm run build`) and then use the compiled output (`node dist/triumvirate.js review ...`).

## Code Quality

Before committing, always run:

```bash
npm run verify   # Lint, format check, type check
npm test         # Run unit tests
```

The project uses:

* **ESLint** for linting
* **Prettier** for formatting
* **TypeScript** for type checking
* **Vitest** for testing
* **Husky** for pre-commit hooks

## Submitting Issues and Pull Requests

* **Issues:** Please use the GitHub Issues tab to report bugs or suggest features. Provide as much detail as possible, including steps to reproduce, expected behavior, and actual behavior.
* **Pull Requests:**
    1.  Fork the repository.
    2.  Create a new branch for your feature or bugfix.
    3.  Make your changes.
    4.  Ensure code quality: run `npm run verify` (lint, format check, type check) and `npm run test`.
    5.  Commit your changes with clear messages.
    6.  Push your branch to your fork.
    7.  Open a Pull Request against the `main` branch of the original repository. Provide a clear description of your changes.

## Adding New Models or Prompt Types

### Adding Models

1. Implement the `LLMProvider` interface in `src/utils/llm-providers.ts`
2. Add API key requirements to `src/utils/api-keys.ts`
3. Add cost information to `llm_costs.json`
4. Update the model instantiation logic in `src/models.ts`
5. Add tests in `test/llmProviders.test.ts`

### Adding Prompts

1. Create a new `.txt` file in `src/prompts/`
2. Update the `loadPromptTemplate` function in `src/prompts/index.ts` to handle the new review type
3. Add the new review type to the CLI options in `src/cli/cliRun.ts`

## Project Structure

```text
src/
├── bin/           # CLI entry points
├── cli/           # CLI commands and actions
├── prompts/       # Review prompt templates
├── types/         # TypeScript type definitions
├── utils/         # Shared utilities (providers, logging, etc.)
├── index.ts       # Main orchestration logic
└── models.ts      # Model routing and execution
test/              # Vitest unit tests
baml_src/          # BAML schema definitions
```

Thank you for contributing!
