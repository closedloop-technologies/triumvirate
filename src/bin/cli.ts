#!/usr/bin/env node
import { run } from '@stricli/core';
import { buildContext } from '../context';
import { app } from '../app';
import { ErrorCategory } from '../utils/model-utils';

/**
 * Global handler for unhandled promise rejections
 * This ensures that any promises that reject without being caught
 * will be properly logged and handled instead of causing silent failures
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[ERROR] UNHANDLED PROMISE REJECTION');
  console.error('This is a bug in Triumvirate that should be reported.');
  
  // Log detailed error information
  if (reason instanceof Error) {
    const errorCategory = (reason as any).category || ErrorCategory.UNKNOWN;
    console.error(`Error Category: ${errorCategory}`);
    console.error(`Error Message: ${reason.message}`);
    
    if (reason.stack) {
      console.error('\nStack Trace:');
      console.error(reason.stack);
    }
  } else {
    console.error(`Rejection Reason: ${reason}`);
  }
  
  console.error('\nPlease report this issue at: https://github.com/closedloop-technologies/triumvirate/issues');
  
  // Exit with error code to ensure CI/CD pipelines detect the failure
  process.exit(1);
});

// Execute the CLI
await run(app, process.argv.slice(2), buildContext(process));
