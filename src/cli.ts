import { run } from '@stricli/core';
import { buildContext } from './context';
import { app } from './app';

// Entry point for CLI when run directly
export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  await run(app, args, buildContext(process));
}
