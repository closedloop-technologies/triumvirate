import * as readline from 'readline';

import { runTriumvirateReview } from '../../index.js';
import type { TriumvirateReviewOptions } from '../../index.js';
import {
    validateApiKeys,
    getApiKeySetupInstructions,
    MODEL_API_KEYS,
} from '../../utils/api-keys.js';
import { logger } from '../../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface CliOptions {
    models?: string;
    ignore?: string;
    diff?: boolean;
    output?: string;
    failOnError?: boolean;
    summaryOnly?: boolean;
    tokenLimit?: number;
    reviewType?: string;
    include?: string;
    ignorePatterns?: string;
    style?: string;
    compress?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    outputShowLineNumbers?: boolean;
    headerText?: string;
    instructionFilePath?: string;
    topFilesLen?: number;
    tokenCountEncoding?: string;
    skipApiKeyValidation?: boolean;
    enhancedReport?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    version?: boolean;
}

export const runCliAction = async (directories: string[], options: CliOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.debug('directories:', directories);
    logger.debug('options:', options);

    if (options.version) {
        await runVersionAction();
        return;
    }

    const { version } = await import('../../../package.json');
    logger.log(`
📦 Triumvirate v${version}
`);

    // Process the CLI options
    const {
        models = 'openai,claude,gemini',
        ignore = '',
        diff = false,
        output,
        failOnError = false,
        summaryOnly = false,
        tokenLimit = 100000,
        reviewType = 'general',
        skipApiKeyValidation = false,
        enhancedReport = true,

        // Repomix flags
        include = '',
        ignorePatterns = '',
        style = 'xml',
        compress = true,
        removeComments = false,
        removeEmptyLines = false,
        outputShowLineNumbers = false,
        headerText,
        instructionFilePath,
        topFilesLen = 20,
        tokenCountEncoding = 'o200k_base',
    } = options;

    // Convert string options to arrays
    const modelList = models.split(',');
    const excludeList = ignore ? ignore.split(',') : [];

    // Check API keys if validation is not skipped
    if (!skipApiKeyValidation) {
        try {
            const keyValidation = validateApiKeys(modelList);

            if (!keyValidation.valid) {
                // Display detailed error message based on validation results
                logger.error(`\n⚠️ ${keyValidation.message}\n`);

                // If there are invalid keys, provide more specific guidance
                if (keyValidation.invalidKeys.length > 0) {
                    logger.error(
                        `⚠️ The following API keys have invalid formats: ${keyValidation.invalidKeys.join(', ')}\n`
                    );
                }

                logger.info(getApiKeySetupInstructions());

                // If failOnError is true, exit immediately
                if (failOnError) {
                    process.exit(1);
                }

                // Filter out models with missing or invalid keys
                const availableModels = modelList.filter(model => {
                    const requirement = MODEL_API_KEYS.find(req => req.model === model);
                    if (!requirement) {
                        return true; // Unknown model, assume it's available
                    }

                    const { envVar } = requirement;
                    return (
                        !keyValidation.missingKeys.includes(envVar) &&
                        !keyValidation.invalidKeys.includes(envVar)
                    );
                });

                if (availableModels.length === 0) {
                    logger.error('\n❌ No models available with valid API keys.\n');
                    process.exit(1);
                }

                // Ask for confirmation before proceeding with available models
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                const confirm = await new Promise<boolean>(resolve => {
                    rl.question(
                        `Continue with available models (${availableModels.join(', ')})? (y/N): `,
                        (answer: string) => {
                            rl.close();
                            resolve(answer.toLowerCase() === 'y');
                        }
                    );
                });

                if (!confirm) {
                    logger.info('Exiting...');
                    process.exit(0);
                }

                logger.info(`Continuing with available models: ${availableModels.join(', ')}...`);

                // Update modelList to only include available models
                modelList.length = 0;
                modelList.push(...availableModels);
            } else {
                logger.info('✅ API key validation passed.');
            }
        } catch (error) {
            // Handle unexpected errors in the validation process
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`\n❌ Error during API key validation: ${errorMessage}\n`);

            if (failOnError) {
                process.exit(1);
            }

            logger.info('Continuing despite API key validation error...');
        }
    }

    // Get absolute paths for directories - we'll use these in the future when needed
    // const targetPaths = directories.map(directory => path.resolve(process.cwd(), directory));

    // Create a spinner for progress reporting
    const spinner = new Spinner('Preparing codebase for review...', {
        quiet: options.quiet,
        verbose: options.verbose,
    });
    spinner.start();

    try {
        // Assemble repomix options
        const repomixOptions = {
            exclude: excludeList,
            diffOnly: diff,
            tokenLimit,
            include: include ? include.split(',') : undefined,
            ignorePatterns: ignorePatterns ? ignorePatterns.split(',') : undefined,
            style,
            compress,
            removeComments,
            removeEmptyLines,
            showLineNumbers: outputShowLineNumbers,
            headerText,
            instructionFilePath,
            topFilesLen,
            tokenCountEncoding,
        };

        // Run the review with our configured options
        const reviewOptions: TriumvirateReviewOptions = {
            models: modelList,
            exclude: excludeList,
            diffOnly: diff,
            outputPath: output,
            failOnError,
            summaryOnly,
            tokenLimit,
            reviewType,
            repomixOptions,
            enhancedReport,
        };

        spinner.update(`Running code review across models: [${modelList.join(', ')}]...`);
        const results = await runTriumvirateReview(reviewOptions);

        spinner.succeed('Code review completed successfully!');
        logger.log('');

        // Output results to console
        for (const result of results) {
            logger.log(`\n--- ${result.model.toUpperCase()} REVIEW ---`);

            if (result.metrics.error) {
                logger.error(`Error: ${result.metrics.error}`);
                continue;
            }

            // Convert review to string regardless of its type
            const reviewText =
                typeof result.review === 'string'
                    ? result.review
                    : (result.review as { text?: string }).text || JSON.stringify(result.review);

            if (summaryOnly) {
                logger.log(reviewText);
            } else {
                logger.log(`${reviewText.slice(0, 500)}...\n(${reviewText.length} chars total)`);
            }

            logger.log(`Metrics: ${result.metrics.latency}, Cost: ${result.metrics.cost}`);
        }

        logger.log('');
        logger.info('Review completed! 🎉');

        // Check if any reviews failed
        if (failOnError && results.some(r => r.metrics.error)) {
            process.exit(1);
        }
    } catch (error) {
        spinner.fail('Error during code review');
        throw error;
    }
};

// Helper function to run version action
async function runVersionAction() {
    const { version } = await import('../../../package.json');
    logger.log(`Triumvirate v${version}`);
}
