import * as fsPromises from 'fs/promises';

import { runVersionAction } from './versionAction.js';
import { runTriumvirateReview } from '../../index.js';
import type { TriumvirateReviewOptions } from '../../index.js';
import type { CliOptions } from '../../types/report.js';
import type { CodeReviewReport } from '../../types/report.js';
import { processApiKeyValidation } from '../../utils/api-keys.js';
import { embedBadgeInReadme } from '../../utils/badge-utils.js';
import {
    DEFAULT_CONTEXT,
    DEFAULT_TIER,
    getMinContextWindow,
    getModelsForTier,
    type ContextSize,
    type ModelTier,
} from '../../utils/constants.js';
import { enhancedLogger } from '../../utils/enhanced-logger.js';
import { TriumvirateError, ErrorCategory } from '../../utils/error-handling.js';

const VALID_PASS_THRESHOLDS = ['strict', 'lenient', 'none'] as const;
const VALID_REVIEW_TYPES = ['general', 'security', 'performance', 'architecture', 'docs'] as const;
const VALID_AGENT_MODELS = ['claude', 'openai', 'gemini'] as const;
const VALID_MODEL_TIERS = ['cheap', 'standard', 'premium'] as const;
const VALID_CONTEXT_SIZES = ['100k', '1m', 'auto'] as const;

/**
 * Read input content from file or STDIN
 * @param inputPath - Path to file or '-' for STDIN
 * @returns The content read from the input source
 */
async function readInputContent(inputPath: string): Promise<string> {
    if (inputPath === '-') {
        return new Promise((resolve, reject) => {
            let data = '';
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', chunk => {
                data += chunk;
            });
            process.stdin.on('end', () => {
                resolve(data);
            });
            process.stdin.on('error', err => {
                reject(
                    new TriumvirateError(
                        `Failed to read from STDIN: ${err.message}`,
                        ErrorCategory.FILE_SYSTEM,
                        'InputReader',
                        false,
                        err
                    )
                );
            });
        });
    }

    try {
        return await fsPromises.readFile(inputPath, 'utf8');
    } catch (error) {
        throw new TriumvirateError(
            `Failed to read input file '${inputPath}': ${error instanceof Error ? error.message : String(error)}`,
            ErrorCategory.FILE_SYSTEM,
            'InputReader',
            false,
            error
        );
    }
}

function parseCommaSeparatedList(value?: string): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function normalizeTier(value?: string): ModelTier {
    const tier = (value ?? DEFAULT_TIER).toLowerCase();
    if (VALID_MODEL_TIERS.includes(tier as ModelTier)) {
        return tier as ModelTier;
    }
    return DEFAULT_TIER;
}

function normalizeContext(value?: string): ContextSize {
    const context = (value ?? DEFAULT_CONTEXT).toLowerCase();
    if (VALID_CONTEXT_SIZES.includes(context as ContextSize)) {
        return context as ContextSize;
    }
    return DEFAULT_CONTEXT;
}

function resolveReviewModels(options: CliOptions): string[] {
    const explicitModels = parseCommaSeparatedList(options.models);
    if (explicitModels.length > 0) {
        return explicitModels;
    }

    const tier = normalizeTier(options.tier);
    const requestedContext = normalizeContext(options.context);
    const selectionContext = requestedContext === 'auto' ? '100k' : requestedContext;
    const { models, fallbacks } = getModelsForTier(tier, selectionContext);

    if (fallbacks.length > 0) {
        enhancedLogger.note(
            `Model tier fallback(s): ${fallbacks
                .map(fallback => `${fallback.provider} ${fallback.from}->${fallback.to}`)
                .join(', ')}`
        );
    }

    return models;
}

/**
 * Validates CLI options and returns normalized values
 * @param options - The CLI options to validate
 * @returns Object with validation result and any error messages
 */
function validateCliOptions(options: CliOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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

    if (
        options.reviewType &&
        !VALID_REVIEW_TYPES.includes(options.reviewType as (typeof VALID_REVIEW_TYPES)[number])
    ) {
        errors.push(
            `Invalid --review-type value: '${options.reviewType}'. Valid values are: ${VALID_REVIEW_TYPES.join(', ')}`
        );
    }

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

    if (options.tier && !VALID_MODEL_TIERS.includes(options.tier as ModelTier)) {
        errors.push(
            `Invalid --tier value: '${options.tier}'. Valid values are: ${VALID_MODEL_TIERS.join(', ')}`
        );
    }

    if (options.context && !VALID_CONTEXT_SIZES.includes(options.context as ContextSize)) {
        errors.push(
            `Invalid --context value: '${options.context}'. Valid values are: ${VALID_CONTEXT_SIZES.join(', ')}`
        );
    }

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
    if (options.quiet) {
        enhancedLogger.setLogLevel('silent');
    } else if (options.verbose) {
        enhancedLogger.setLogLevel('debug');
    } else {
        enhancedLogger.setLogLevel('info');
    }

    enhancedLogger.initApiLogger();

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

    const {
        ignore = '',
        diff = false,
        outputDir = './.triumvirate',
        failOnError = false,
        summaryOnly = false,
        tokenLimit,
        reviewType = 'general',
        passThreshold = 'none',
        agentModel = 'claude',
        skipApiKeyValidation = false,
        enhancedReport = true,
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
        input,
    } = options;

    let inputContent: string | undefined;
    if (input) {
        enhancedLogger.log(`Reading input from: ${input === '-' ? 'STDIN' : input}`);
        inputContent = await readInputContent(input);
        enhancedLogger.log(`Input content loaded (${inputContent.length} characters)`);
    }

    let modelList = resolveReviewModels(options);
    const excludeList = parseCommaSeparatedList(ignore);

    if (!skipApiKeyValidation) {
        const validatedModels = await processApiKeyValidation(
            modelList,
            failOnError,
            enhancedLogger
        );
        modelList = validatedModels;
    }

    const effectiveTokenLimit = tokenLimit
        ? Number(tokenLimit)
        : getMinContextWindow(modelList);

    enhancedLogger.log(
        `Token limit: ${effectiveTokenLimit} (based on min context window of selected models)`
    );

    try {
        const repomixOptions = {
            exclude: excludeList,
            diffOnly: diff,
            tokenLimit: effectiveTokenLimit,
            include: parseCommaSeparatedList(include).length
                ? parseCommaSeparatedList(include)
                : undefined,
            ignorePatterns: parseCommaSeparatedList(ignorePatterns).length
                ? parseCommaSeparatedList(ignorePatterns)
                : undefined,
            style,
            compress,
            removeComments,
            removeEmptyLines,
            showLineNumbers: outputShowLineNumbers,
            headerText,
            instructionFilePath,
            topFilesLen,
            tokenCountEncoding,
            task: options.task,
            agentModel,
            enableSmartCompress: true,
        };

        const reviewOptions: TriumvirateReviewOptions = {
            models: modelList,
            diffOnly: diff,
            outputPath: outputDir,
            failOnError,
            summaryOnly,
            tokenLimit: effectiveTokenLimit,
            reviewType,
            repomixOptions,
            enhancedReport,
            agentModel,
            inputContent,
            options,
        };

        const results = await runTriumvirateReview(reviewOptions);

        let reviewPassed = true;
        if (passThreshold !== 'none' && enhancedReport && !Array.isArray(results)) {
            const report = results as CodeReviewReport;
            const improvementFindings = Object.values(report.findingsByCategory || {})
                .flat()
                .filter(f => !f.isStrength);

            if (passThreshold === 'strict') {
                reviewPassed = !improvementFindings.some(
                    f => Object.values(f.modelAgreements).filter(Boolean).length >= 2
                );
            } else if (passThreshold === 'lenient') {
                reviewPassed = !improvementFindings.some(
                    f => Object.values(f.modelAgreements).filter(Boolean).length >= 3
                );
            }
        }

        if (failOnError || !reviewPassed) {
            if (Array.isArray(results)) {
                if (results.some(r => r.metrics?.error)) {
                    enhancedLogger.error('Review failed due to model errors.');
                    process.exit(1);
                }
            } else {
                const report = results as CodeReviewReport;
                if (report.modelMetrics && report.modelMetrics.some(m => m?.error)) {
                    process.exit(1);
                } else if (!reviewPassed) {
                    enhancedLogger.error(`Review failed to meet pass threshold: ${passThreshold}`);
                    process.exit(1);
                }
            }
        }

        if (options.badge !== undefined && enhancedReport && !Array.isArray(results)) {
            const report = results as CodeReviewReport;
            const badgePath = typeof options.badge === 'string' ? options.badge : undefined;
            embedBadgeInReadme(report, { readmePath: badgePath });
        }

        enhancedLogger.printApiSummary();
    } catch (error) {
        enhancedLogger.error('Error during code review');
        enhancedLogger.printApiSummary();
        throw error;
    }
};
