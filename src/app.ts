import { buildApplication, buildRouteMap } from '@stricli/core';
import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { name, version, description } from '../package.json';
import { subdirCommand } from './commands/subdir/command';
import { nestedRoutes } from './commands/nested/commands';

const routes = buildRouteMap({
  routes: {
    subdir: subdirCommand,
    nested: nestedRoutes,
    install: buildInstallCommand('triumvirate', { bash: '__triumvirate_bash_complete' }),
    uninstall: buildUninstallCommand('triumvirate', { bash: true }),
  },
  docs: {
    brief: description,
    hideRoute: {
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
});
