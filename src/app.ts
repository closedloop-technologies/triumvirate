// src/app.ts
import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { name, version } from '../package.json';
import type { LocalContext } from './context';
import type { ReviewCommandFlags } from './impl';

const REVIEW_TYPES = ['general', 'security', 'performance', 'architecture', 'docs'];

// Create the main command with explicit type parameters
const runCommand = buildCommand<LocalContext, [ReviewCommandFlags]>({
  loader: async () => (await import('./impl')).review,
  parameters: {
    flags: {
      models: {
        kind: 'parsed',
        brief: 'Comma-separated list of models',
        parse: (input: string) => input.split(','),
        optional: true,
        defaultValue: 'openai,claude,gemini',
      },
      exclude: {
        kind: 'parsed',
        brief: 'Patterns to exclude',
        parse: (input: string) => input.split(','),
        optional: true,
      },
      diff: {
        kind: 'boolean',
        brief: 'Only review files changed in git diff',
        optional: true,
        default: false,
      },
      output: {
        kind: 'string',
        brief: 'Path to write review output JSON',
        optional: true,
      },
      failOnError: {
        kind: 'boolean',
        brief: 'Exit with non-zero code if any model fails',
        optional: true,
        default: false,
      },
      summaryOnly: {
        kind: 'boolean',
        brief: 'Only include summary in results',
        optional: true,
        default: false,
      },
      tokenLimit: {
        kind: 'number',
        brief: 'Maximum tokens to send to the model',
        optional: true,
        default: 100000,
      },
      reviewType: {
        kind: 'string',
        brief: `Type of review: ${REVIEW_TYPES.join(', ')}`,
        optional: true,
        default: 'general',
      },
      include: {
        kind: 'string',
        brief: 'Patterns to include',
        optional: true,
      },
      ignorePatterns: {
        kind: 'string',
        brief: 'Patterns to ignore',
        optional: true,
      },
      style: {
        kind: 'string',
        brief: 'Output style (xml, markdown, plain)',
        optional: true,
        default: 'xml',
      },
      compress: {
        kind: 'boolean',
        brief: 'Compress code to reduce token count',
        optional: true,
        default: true,
      },
      removeComments: {
        kind: 'boolean',
        brief: 'Remove comments from source files',
        optional: true,
        default: false,
      },
      removeEmptyLines: {
        kind: 'boolean',
        brief: 'Remove empty lines from source files',
        optional: true,
        default: false,
      },
      showLineNumbers: {
        kind: 'boolean',
        brief: 'Add line numbers to output',
        optional: true,
        default: false,
      },
      headerText: {
        kind: 'string',
        brief: 'Text to include in file header',
        optional: true,
      },
      instructionFilePath: {
        kind: 'string',
        brief: 'Path to custom instructions file',
        optional: true,
      },
      topFilesLen: {
        kind: 'number',
        brief: 'Number of top files in summary',
        optional: true,
        default: 20,
      },
      tokenCountEncoding: {
        kind: 'string',
        brief: 'Token counting method',
        optional: true,
        default: 'o200k_base',
      },
    },
  },
  docs: {
    brief: 'Run code review across multiple LLMs',
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
