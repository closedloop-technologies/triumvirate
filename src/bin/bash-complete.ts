#!/usr/bin/env node

/**
 * Bash completion script for Triumvirate CLI
 * 
 * This script provides bash completion for the Triumvirate CLI commands and options.
 */

import { Command } from 'commander';

// Get the current command line being completed
const line = process.env['COMP_LINE'] || '';
const point = parseInt(process.env['COMP_POINT'] || '0', 10);

// Extract the part of the line up to the cursor position
const lineUpToCursor = line.substring(0, point);

// Parse the command line arguments
const args = lineUpToCursor.split(' ');

// Create a list of all possible completions
const completions = [
  // Commands
  'install',
  'uninstall',
  // Options
  '--version', '-v',
  '--models', '-m',
  '--output', '-o',
  '--style',
  '--compress',
  '--output-show-line-numbers',
  '--summary-only',
  '--enhanced-report',
  '--remove-comments',
  '--remove-empty-lines',
  '--header-text',
  '--instruction-file-path',
  '--include',
  '--ignore', '-i',
  '--diff',
  '--review-type',
  '--token-limit',
  '--fail-on-error',
  '--token-count-encoding',
  '--top-files-len',
  '--skip-api-key-validation',
  '--verbose',
  '--quiet'
];

// Filter completions based on the current word being completed
const currentWord = args[args.length - 1] || '';
const matchingCompletions = completions.filter(c => c.startsWith(currentWord));

// Output matching completions
matchingCompletions.forEach(completion => {
  console.log(completion);
});
