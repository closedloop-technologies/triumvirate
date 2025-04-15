import { runTriumvirateReview } from '../../index.js';
import type { TriumvirateReviewOptions } from '../../index.js';
import type { CliOptions } from '../../types/report.js';
import { processApiKeyValidation } from '../../utils/api-keys.js';
import { enhancedLogger } from '../../utils/enhanced-logger.js';

export const runCliAction = async (directories: string[], options: CliOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        enhancedLogger.setLogLevel('silent');
    } else if (options.verbose) {
        enhancedLogger.setLogLevel('debug');
    } else {
        enhancedLogger.setLogLevel('info');
    }

    // Initialize the API logger
    enhancedLogger.initApiLogger();

    enhancedLogger.log('directories:', directories);
    enhancedLogger.log('options:', options);

    if (options.version) {
        await runVersionAction();
        return;
    }

    const { version } = await import('../../../package.json');
    enhancedLogger.log(`
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
    let modelList = models.split(',');
    const excludeList = ignore ? ignore.split(',') : [];

    // Check API keys if validation is not skipped
    if (!skipApiKeyValidation) {
        // Use the centralized API key validation function
        const validatedModels = await processApiKeyValidation(
            modelList,
            failOnError,
            enhancedLogger
        );
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
        // Check if any reviews failed
        if (failOnError && results.some(r => r.metrics.error)) {
            process.exit(1);
        }

        // Print API usage summary
        enhancedLogger.printApiSummary();
    } catch (error) {
        enhancedLogger.error('Error during code review');

        // Print API usage summary even if there was an error
        enhancedLogger.printApiSummary();

        throw error;
    }
};

// Helper function to run version action
async function runVersionAction() {
    const { version } = await import('../../../package.json');
    enhancedLogger.log(`Triumvirate v${version}`);
}
