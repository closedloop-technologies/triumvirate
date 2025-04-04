// src/app.ts
import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { name, version } from '../package.json';
import type { LocalContext } from './context';
import type { ReviewCommandFlags } from './impl';

const REVIEW_TYPES = ['general', 'security', 'performance', 'architecture', 'docs'];

// Create the main command with explicit type parameters
const runCommand = buildCommand<ReviewCommandFlags, [], LocalContext>({
    loader: async () => {
        const { review } = await import('./impl');
        return review;
    },
    parameters: {
        flags: {
            models: {
                kind: 'parsed',
                brief: 'Comma-separated list of models (default: openai,claude,gemini)',
                parse: (input: string) => input,
                optional: true,
            },
            exclude: {
                kind: 'parsed',
                brief: 'Patterns to exclude from review',
                parse: (input: string) => input,
                optional: true,
            },
            diff: {
                kind: 'boolean',
                brief: 'Only review files changed in git diff',
                optional: true,
            },
            output: {
                kind: 'parsed',
                brief: 'Path to write review output JSON',
                parse: (input: string) => input,
                optional: true,
            },
            failOnError: {
                kind: 'boolean',
                brief: 'Exit with non-zero code if any model fails',
                optional: true,
            },
            summaryOnly: {
                kind: 'boolean',
                brief: 'Only include summary in results',
                optional: true,
            },
            tokenLimit: {
                kind: 'parsed',
                brief: 'Maximum tokens to send to the model (default: 100000)',
                parse: (input: string) => parseInt(input, 10),
                optional: true,
            },
            reviewType: {
                kind: 'parsed',
                brief: `Type of review: ${REVIEW_TYPES.join(', ')} (default: general)`,
                parse: (input: string) => input,
                optional: true,
            },
            include: {
                kind: 'parsed',
                brief: 'Patterns to include in review',
                parse: (input: string) => input,
                optional: true,
            },
            ignorePatterns: {
                kind: 'parsed',
                brief: 'Additional patterns to ignore',
                parse: (input: string) => input,
                optional: true,
            },
            style: {
                kind: 'parsed',
                brief: 'Output style (xml, markdown, plain) (default: xml)',
                parse: (input: string) => input,
                optional: true,
            },
            compress: {
                kind: 'boolean',
                brief: 'Compress code to reduce token count (default: enabled)',
                optional: true,
            },
            removeComments: {
                kind: 'boolean',
                brief: 'Remove comments from source files',
                optional: true,
            },
            removeEmptyLines: {
                kind: 'boolean',
                brief: 'Remove empty lines from source files',
                optional: true,
            },
            showLineNumbers: {
                kind: 'boolean',
                brief: 'Add line numbers to output',
                optional: true,
            },
            headerText: {
                kind: 'parsed',
                brief: 'Text to include in file header',
                parse: (input: string) => input,
                optional: true,
            },
            instructionFilePath: {
                kind: 'parsed',
                brief: 'Path to custom instructions file',
                parse: (input: string) => input,
                optional: true,
            },
            topFilesLen: {
                kind: 'counter',
                brief: 'Number of top files in summary (default: 20)',
                optional: true,
            },
            tokenCountEncoding: {
                kind: 'parsed',
                brief: 'Token counting method (default: o200k_base)',
                parse: (input: string) => input,
                optional: true,
            },
            skipApiKeyValidation: {
                kind: 'boolean',
                brief: 'Skip API key validation check',
                optional: true,
            },
            enhancedReport: {
                kind: 'boolean',
                brief: 'Generate enhanced report with model agreement analysis',
                optional: true,
            },
        },
    },
    docs: {
        brief: `Run code review across multiple LLMs

Triumvirate performs code reviews using multiple language models.
It packages your codebase using Repomix and sends it to the requested models.

Default models: openai, claude, gemini
Default review type: general
Token limit: 100,000 tokens
Compression: enabled by default

Required API keys (only for the models you use):
- OPENAI_API_KEY for OpenAI models
- ANTHROPIC_API_KEY for Claude models
- GOOGLE_API_KEY for Gemini models

API keys can be set in a .env file or as environment variables.
`,
    },
});

// Define the routes
const routes = buildRouteMap({
    routes: {
        // Add as both default and "run" subcommand
        '': runCommand,
        run: runCommand,
        install: buildInstallCommand('triumvirate', { bash: '__triumvirate_bash_complete' }),
        uninstall: buildUninstallCommand('triumvirate', { bash: true }),
    },
    defaultCommand: '',
    docs: {
        brief: 'Triumvirate CLI for code review across multiple LLMs',
    },
});

// Build the application
export const app = buildApplication(routes, {
    name,
    versionInfo: {
        currentVersion: version,
    },
    scanner: {
        caseStyle: 'allow-kebab-for-camel',
    },
});

// Import missing functions at the end to avoid circular reference issues
import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
