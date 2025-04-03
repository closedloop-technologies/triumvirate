// src/app.ts
import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { name, version, description } from '../package.json';

// Create the main command
const runCommand = buildCommand({
  loader: async () => import('./impl'),
  parameters: {
    flags: {
      models: {
        kind: 'parsed',
        brief: 'Comma-separated list of models',
        parse: (input: string) => input.split(','),
        optional: true,
      },
      exclude: {
        kind: 'parsed',
        brief: 'Comma-separated paths to exclude',
        parse: (input: string) => input.split(','),
        optional: true,
      },
      diff: {
        kind: 'boolean',
        brief: 'Review only diffed files',
        optional: true,
      },
      output: {
        kind: 'parsed',
        parse: String,
        brief: 'Output file for results',
        optional: true,
      },
      failOnError: {
        kind: 'boolean',
        brief: 'Fail the process on error in any model',
        optional: true,
      },
      summaryOnly: {
        kind: 'boolean',
        brief: 'Only return summary of model responses',
        optional: true,
      },
      tokenLimit: {
        kind: 'parsed',
        parse: Number,
        brief: 'Maximum number of tokens to allow in the codebase',
        optional: true,
      },
    },
  },
  docs: {
    brief: 'Run Triumvirate Code Review',
  },
});

const routes = buildRouteMap({
  routes: {
    // Add as both default and "run" subcommand
    '': runCommand,
    run: runCommand,
    install: buildInstallCommand('triumvirate', { bash: '__triumvirate_bash_complete' }),
    uninstall: buildUninstallCommand('triumvirate', { bash: true }),
  },
  defaultCommand: '', // Make the empty route the default command
  docs: {
    brief: description,
    hideRoute: {
      '': true, // Hide the empty route from help
      install: true,
      uninstall: true,
    },
  },
});

export const app = buildApplication(routes, {
  name,
  versionInfo: {
    currentVersion: version,
  },
  scanner: {
    caseStyle: 'allow-kebab-for-camel',
  },
});
