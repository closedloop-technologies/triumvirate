// src/app.ts
import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { name, version, description } from '../package.json';

// Create the default command - this allows running the tool without specifying "run"
const defaultCommand = buildCommand({
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
    },
  },
  docs: {
    brief: 'Run Triumvirate Code Review',
  },
});

const routes = buildRouteMap({
  routes: {
    // Add the default command as both root and as "run" subcommand
    '': defaultCommand,
    run: defaultCommand,
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
