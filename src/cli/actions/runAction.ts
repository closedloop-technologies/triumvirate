import { runTriumvirateReview } from '../../index.js';
import type { TriumvirateReviewOptions } from '../../index.js';
import type { CliOptions } from '../../types/report.js';
import { processApiKeyValidation } from '../../utils/api-keys.js';
import { logger } from '../../utils/logger.js';

export const runCliAction = async (directories: string[], options: CliOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.log('directories:', directories);
    logger.log('options:', options);

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

    console.log('models', models);

    // Convert string options to arrays
    let modelList = models.split(',');
    const excludeList = ignore ? ignore.split(',') : [];
    console.log('modelList', modelList);

    // Check API keys if validation is not skipped
    if (!skipApiKeyValidation) {
        // Use the centralized API key validation function
        const validatedModels = await processApiKeyValidation(modelList, failOnError, logger);
        modelList = validatedModels;
    }

    // Get absolute paths for directories - we'll use these in the future when needed
    // const targetPaths = directories.map(directory => path.resolve(process.cwd(), directory));

    // Create a spinner for progress reporting
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

        const results = await runTriumvirateReview(reviewOptions);

        logger.log('Code review completed successfully!');

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
        logger.error('Error during code review');
        throw error;
    }
};

// Helper function to run version action
async function runVersionAction() {
    const { version } = await import('../../../package.json');
    logger.log(`Triumvirate v${version}`);
}
