import { runVersionAction } from './versionAction.js';
import { runTriumvirateReview } from '../../index.js';
import type { TriumvirateReviewOptions } from '../../index.js';
import type { CliOptions } from '../../types/report.js';
import type { CodeReviewReport } from '../../types/report.js';
import { processApiKeyValidation } from '../../utils/api-keys.js';
import { DEFAULT_MODELS } from '../../utils/constants.js';
import { enhancedLogger } from '../../utils/enhanced-logger.js';

const VALID_PASS_THRESHOLDS = ['strict', 'lenient', 'none'] as const;
const VALID_REVIEW_TYPES = ['general', 'security', 'performance', 'architecture', 'docs'] as const;
const VALID_AGENT_MODELS = ['claude', 'openai', 'gemini'] as const;

/**
 * Validates CLI options and returns normalized values
 * @param options - The CLI options to validate
 * @returns Object with validation result and any error messages
 */
function validateCliOptions(options: CliOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate passThreshold
    if (
        options.passThreshold &&
        !VALID_PASS_THRESHOLDS.includes(
            options.passThreshold as (typeof VALID_PASS_THRESHOLDS)[number]
        )
    ) {
        errors.push(
            `Invalid --pass-threshold value: '${options.passThreshold}'. Valid values are: ${VALID_PASS_THRESHOLDS.join(', ')}`
        );
    }

    // Validate reviewType
    if (
        options.reviewType &&
        !VALID_REVIEW_TYPES.includes(options.reviewType as (typeof VALID_REVIEW_TYPES)[number])
    ) {
        errors.push(
            `Invalid --review-type value: '${options.reviewType}'. Valid values are: ${VALID_REVIEW_TYPES.join(', ')}`
        );
    }

    // Validate agentModel
    if (
        options.agentModel &&
        !VALID_AGENT_MODELS.includes(
            options.agentModel.toLowerCase() as (typeof VALID_AGENT_MODELS)[number]
        )
    ) {
        errors.push(
            `Invalid --agent-model value: '${options.agentModel}'. Valid values are: ${VALID_AGENT_MODELS.join(', ')}`
        );
    }

    // Validate tokenLimit is a positive number if provided
    if (
        options.tokenLimit !== undefined &&
        (isNaN(Number(options.tokenLimit)) || Number(options.tokenLimit) <= 0)
    ) {
        errors.push(
            `Invalid --token-limit value: '${options.tokenLimit}'. Must be a positive number.`
        );
    }

    return { valid: errors.length === 0, errors };
}

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

    // Validate CLI options before proceeding
    const validation = validateCliOptions(options);
    if (!validation.valid) {
        validation.errors.forEach(error => enhancedLogger.error(error));
        process.exit(1);
    }

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
        models = DEFAULT_MODELS.join(','),
        ignore = '',
        diff = false,
        // output, // Deprecated in favor of outputDir
        outputDir = './.triumvirate', // DoD: Default output dir
        failOnError = false,
        summaryOnly = false,
        tokenLimit,
        reviewType = 'general',
        passThreshold = 'none', // DoD: Add pass threshold
        agentModel = 'claude', // DoD: Add agent model
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
            diffOnly: diff,
            outputPath: outputDir, // Use outputDir
            failOnError,
            summaryOnly,
            tokenLimit,
            reviewType,
            repomixOptions, // Pass repomix specific flags
            enhancedReport,
            agentModel, // Pass agent model
            // Pass other options if needed by runTriumvirateReview
            options: options, // Pass original options for context
        };

        const results = await runTriumvirateReview(reviewOptions);

        // --- DoD: Pass/Fail Threshold Logic ---
        let reviewPassed = true;
        if (passThreshold !== 'none' && enhancedReport && !Array.isArray(results)) {
            const report = results as CodeReviewReport;
            const improvementFindings = Object.values(report.findingsByCategory || {})
                .flat()
                .filter(f => !f.isStrength);

            if (passThreshold === 'strict') {
                // Fail if >= 2 models agree on any improvement
                reviewPassed = !improvementFindings.some(
                    f => Object.values(f.modelAgreements).filter(Boolean).length >= 2
                );
            } else if (passThreshold === 'lenient') {
                // Fail if >= 3 models agree on any improvement
                reviewPassed = !improvementFindings.some(
                    f => Object.values(f.modelAgreements).filter(Boolean).length >= 3
                );
            }
        }

        // Check if any reviews had errors OR if the threshold failed
        if (failOnError || !reviewPassed) {
            if (Array.isArray(results)) {
                if (results.some(r => r.metrics?.error)) {
                    enhancedLogger.error('Review failed due to model errors.');
                    process.exit(1);
                }
            } else {
                const report = results as CodeReviewReport;
                // Check if any models in the report contain errors
                if (report.modelMetrics && report.modelMetrics.some(m => m?.error)) {
                    process.exit(1);
                } else if (!reviewPassed) {
                    enhancedLogger.error(`Review failed to meet pass threshold: ${passThreshold}`);
                    process.exit(1);
                }
            }
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

// Removed internal runVersionAction, imported from versionAction.ts
