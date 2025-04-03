import { Command } from 'commander';

import { runTriumvirateReview } from './index.js';

const program = new Command();

program
  .option('--models <models>', 'Comma-separated list of models', val => val.split(','))
  .option('--exclude <paths>', 'Comma-separated paths to exclude', val => val.split(','))
  .option('--diff', 'Review only diffed files')
  .option('--output <path>', 'Output file for results')
  .option('--fail-on-error', 'Fail the process on error in any model')
  .option('--summary-only', 'Only return summary of model responses')
  .action(async opts => {
    const results = await runTriumvirateReview({
      models: opts.models || ['openai'],
      exclude: opts.exclude || [],
      diffOnly: opts.diff || false,
      outputPath: opts.output,
      failOnError: opts.failOnError || false,
      summaryOnly: opts.summaryOnly || false,
    });
    console.log('Review Results:', results);
  });

program.parse(process.argv);
