import { run } from '@stricli/core';

import { app } from './app';
import { buildContext } from './context';

// Entry point for CLI when run directly
export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
    await run(app, args, buildContext(process));
}
