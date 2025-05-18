import { Command } from 'commander';

import { runInstallAction } from './actions/installAction.js';
import { runNextAction } from './actions/nextAction.js';
import { runPlanAction } from './actions/planAction.js';
import { runCliAction } from './actions/runAction.js';
import { runSummarizeAction } from './actions/summarizeAction.js';
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
            .option('--verbose', 'enable verbose logging for detailed output')
            .option('--quiet', 'disable all output to stdout')
            .option('-v, --version', 'show version information');

        // Review command (previously the report command)
        const reviewCommand = program
            .command('review')
            .description('Run a code review with default settings and creates the summary')
            .argument('[directories...]', 'list of directories to process', ['.'])

            // Triumvirate-specific options
            .option(
                '-m, --models <models>',
                'comma-separated list of models (default: openai/gpt-4.1,anthropic/claude-3-7-sonnet-20250219,google/gemini-2.5-pro-exp-03-25)'
            )
            .option(
                '--review-type <type>',
                'DEPRECATED: use --task instead. Suggested types: general, security, performance, architecture, docs'
            )
            .option('--task <task>', 'task description to focus the review')
            .option(
                '--doc <path>',
                'documentation file or URL (can be repeated)',
                (value, previous: string[] = []) => {
                    previous.push(value);
                    return previous;
                },
                []
            )
            .option('--fail-on-error', 'exit with non-zero code if any model fails')
            .option('--skip-api-key-validation', 'skip API key validation check')
            .option('--enhanced-report', 'generate enhanced report with model agreement analysis')
            .option('--summary-only', 'only include summary in results')

            // Repomix-specific options
            .option('--token-limit <number>', 'maximum tokens to send to the model')
            .option(
                '--token-count-encoding <encoding>',
                'specify token count encoding (e.g., o200k_base, cl100k_base)'
            )
            .option('--compress', 'perform code compression to reduce token count')
            .option('--remove-comments', 'remove comments')
            .option('--remove-empty-lines', 'remove empty lines')
            .option('--top-files-len <number>', 'specify the number of top files to display')
            .option('--header-text <text>', 'specify the header text')
            .option(
                '--instruction-file-path <path>',
                'path to a file containing detailed custom instructions'
            )

            // Output options
            .option('-o, --output <file>', 'specify the output file name')
            .option('--style <type>', 'specify the output style (xml, markdown, plain)')
            .option('--output-show-line-numbers', 'add line numbers to each line in the output')

            // Filter options
            .option('--include <patterns>', 'list of include patterns (comma-separated)')
            .option('-i, --ignore <patterns>', 'additional ignore patterns (comma-separated)')
            .option('--diff', 'only review files changed in git diff')
            .action(runCliAction);

        // Add custom help text for the review command
        reviewCommand.addHelpText(
            'after',
            `
Option Groups:

  Triumvirate Options:
    -m, --models                    Models to use for code review
    --review-type                  DEPRECATED: use --task instead
    --task                         Task description for the review (e.g. security, performance, architecture, docs)
    --doc                          Documentation file or URL
    --fail-on-error                Exit with error if any model fails
    --skip-api-key-validation      Skip API key validation
    --enhanced-report              Generate enhanced report with model agreement
    --summary-only                 Only include summary in results

  Repomix Options:
    --token-limit                  Maximum tokens to send to the model
    --token-count-encoding         Token count encoding to use
    --compress                     Compress code to reduce token count
    --remove-comments              Remove comments from code
    --remove-empty-lines           Remove empty lines from code
    --top-files-len                Number of top files to display
    --header-text                  Header text for the report
    --instruction-file-path        Path to custom instructions file

  Output Options:
    -o, --output                   Output file path
    --style                        Output style format
    --output-show-line-numbers     Show line numbers in output

  Filter Options:
    --include                      Patterns to include
    -i, --ignore                   Patterns to ignore
    --diff                         Only review files in git diff
`
        );

        // Summarize command - Just runs the summary from an existing set of raw reports
        program
            .command('summarize')
            .description('Generate a summary from existing raw reports')
            .option('-i, --input <file>', 'input file containing raw reports')
            .option('-o, --output <file>', 'output file for the summary')
            .option('--enhanced-report', 'generate enhanced report with model agreement analysis')
            .action(runSummarizeAction);

        // Plan command - Decompose the review into a set of tasks with dependencies
        program
            .command('plan')
            .description('Decompose a review into a set of tasks with dependencies')
            .option('-i, --input <file>', 'input file containing the summary')
            .option('-o, --output <file>', 'output file for the plan')
            .action(runPlanAction);

        // Next command - Emits the next available task
        program
            .command('next')
            .description('Read the plan and emit the next available task')
            .option('-i, --input <file>', 'input file containing the plan')
            .action(runNextAction);

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
