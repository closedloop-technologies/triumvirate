import { Command } from 'commander';

import { runInstallAction } from './actions/installAction.js';
import { runCliAction } from './actions/runAction.js';
import { runUninstallAction } from './actions/uninstallAction.js';
import { handleError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

// Semantic mapping for CLI suggestions
const semanticSuggestionMap: Record<string, string[]> = {
    exclude: ['--ignore'],
    reject: ['--ignore'],
    omit: ['--ignore'],
    skip: ['--ignore'],
    save: ['--output'],
    export: ['--output'],
    out: ['--output'],
    file: ['--output'],
    format: ['--style'],
    type: ['--style'],
    debug: ['--verbose'],
    detailed: ['--verbose'],
    silent: ['--quiet'],
    mute: ['--quiet'],
    add: ['--include'],
    with: ['--include'],
};

// Create the commander program
const program = new Command();

export const run = async () => {
    try {
        program
            .description(
                'Triumvirate - Run codebase reviews across OpenAI, Claude, and Gemini models'
            )
            .argument('[directories...]', 'list of directories to process', ['.'])
            // Basic Options
            .option('-v, --version', 'show version information')
            // Model Options
            .option(
                '-m, --models <models>',
                'comma-separated list of models (default: openai,claude,gemini)'
            )
            // Output Options
            .option('-o, --output <file>', 'specify the output file name')
            .option('--style <type>', 'specify the output style (xml, markdown, plain)')
            .option('--compress', 'perform code compression to reduce token count')
            .option('--output-show-line-numbers', 'add line numbers to each line in the output')
            .option('--summary-only', 'only include summary in results')
            .option('--enhanced-report', 'generate enhanced report with model agreement analysis')
            .option('--remove-comments', 'remove comments')
            .option('--remove-empty-lines', 'remove empty lines')
            .option('--header-text <text>', 'specify the header text')
            .option(
                '--instruction-file-path <path>',
                'path to a file containing detailed custom instructions'
            )
            // Filter Options
            .option('--include <patterns>', 'list of include patterns (comma-separated)')
            .option('-i, --ignore <patterns>', 'additional ignore patterns (comma-separated)')
            .option('--diff', 'only review files changed in git diff')
            // Review Options
            .option(
                '--review-type <type>',
                'type of review: general, security, performance, architecture, docs'
            )
            .option(
                '--token-limit <number>',
                'maximum tokens to send to the model',
                Number.parseInt
            )
            .option('--fail-on-error', 'exit with non-zero code if any model fails')
            // Token Count Options
            .option(
                '--token-count-encoding <encoding>',
                'specify token count encoding (e.g., o200k_base, cl100k_base)'
            )
            // Other Options
            .option(
                '--top-files-len <number>',
                'specify the number of top files to display',
                Number.parseInt
            )
            .option('--skip-api-key-validation', 'skip API key validation check')
            .option('--verbose', 'enable verbose logging for detailed output')
            .option('--quiet', 'disable all output to stdout')
            .action(runCliAction);

        // Add install and uninstall commands
        program
            .command('install')
            .description('Install Triumvirate CLI completion')
            .action(runInstallAction);

        program
            .command('uninstall')
            .description('Uninstall Triumvirate CLI completion')
            .action(runUninstallAction);

        // Custom error handling with semantic suggestions
        const configOutput = program.configureOutput();
        const originalOutputError = configOutput.outputError || ((str, write) => write(str));

        program.configureOutput({
            outputError: (str, write) => {
                // Check if this is an unknown option error
                if (str.includes('unknown option')) {
                    const match = str.match(/unknown option '?(-{1,2}[^ ']+)'?/i);
                    if (match?.[1]) {
                        const unknownOption = match[1];
                        const cleanOption = unknownOption.replace(/^-+/, '');

                        // Check if the option has a semantic match
                        const semanticMatches = semanticSuggestionMap[cleanOption];
                        if (semanticMatches) {
                            // We have a direct semantic match
                            logger.error(`✖ Unknown option: ${unknownOption}`);
                            logger.info(`Did you mean: ${semanticMatches.join(' or ')}?`);
                            return;
                        }
                    }
                }

                // Fall back to the original Commander error handler
                originalOutputError(str, write);
            },
        });

        await program.parseAsync(process.argv);
    } catch (error) {
        handleError(error);
    }
};
