#!/usr/bin/env node

/**
 * Triumvirate CLI Entry Point
 * 
 * This is the main entry point for the Triumvirate CLI tool.
 * It runs codebase reviews across multiple LLM providers (OpenAI, Claude, and Gemini).
 */

const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);

const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
};

if (major === undefined || major < 20) {
  console.error(`Triumvirate requires Node.js version 20 or higher. Current version: ${nodeVersion}\n`);
  process.exit(EXIT_CODES.ERROR);
}

function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(EXIT_CODES.ERROR);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
    process.exit(EXIT_CODES.ERROR);
  });

  function shutdown() {
    process.exit(EXIT_CODES.SUCCESS);
  }

  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down...');
    shutdown();
  });
  process.on('SIGTERM', shutdown);
}

(async () => {
  try {
    setupErrorHandlers();

    const { run } = await import('../cli/cliRun.js');
    await run();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Fatal Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error('Fatal Error:', error);
    }

    process.exit(EXIT_CODES.ERROR);
  }
})();
