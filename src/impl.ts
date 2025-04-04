import type { LocalContext } from './context';
import { runTriumvirateReview } from './index';
import type { TriumvirateReviewOptions } from './index';
import { validateApiKeys, getApiKeySetupInstructions, MODEL_API_KEYS } from './utils/api-keys';

export interface ReviewCommandFlags {
    // Triumvirate's original flags
    readonly models?: string | string[];
    readonly exclude?: string | string[];
    readonly diff?: boolean;
    readonly output?: string;
    readonly failOnError?: boolean;
    readonly summaryOnly?: boolean;
    readonly tokenLimit?: number;

    // New review configuration flag
    readonly reviewType?: string;

    // Repomix passthrough flags
    readonly include?: string;
    readonly ignorePatterns?: string;
    readonly style?: string;
    readonly compress?: boolean;
    readonly removeComments?: boolean;
    readonly removeEmptyLines?: boolean;
    readonly showLineNumbers?: boolean;
    readonly headerText?: string;
    readonly instructionFilePath?: string;
    readonly topFilesLen?: number;
    readonly tokenCountEncoding?: string;

    // Skip API key validation flag (mainly for testing)
    readonly skipApiKeyValidation?: boolean;

    readonly enhancedReport?: boolean;
}

export async function review(flags: ReviewCommandFlags): Promise<void> {
    const {
        models = ['openai', 'claude', 'gemini'],
        exclude = [],
        diff = false,
        output,
        failOnError = false,
        summaryOnly = false,
        tokenLimit = 100000,
        reviewType,
        skipApiKeyValidation = false,
        enhancedReport = true,

        // Repomix flags
        include,
        ignorePatterns,
        style = 'xml',
        compress = true,
        removeComments = false,
        removeEmptyLines = false,
        showLineNumbers = false,
        headerText,
        instructionFilePath,
        topFilesLen = 20,
        tokenCountEncoding = 'o200k_base',
    } = flags;

    // Ensure models is array if passed as comma-separated string
    const modelList = Array.isArray(models)
        ? models
        : typeof models === 'string' && models !== undefined
          ? models?.split(',')
          : ['openai', 'claude', 'gemini'];

    // Ensure exclude is array if passed as comma-separated string
    const excludeList = Array.isArray(exclude)
        ? exclude
        : typeof exclude === 'string' && exclude
          ? exclude.split(',')
          : [];

    // Check API keys if validation is not skipped
    if (!skipApiKeyValidation) {
        try {
            const keyValidation = validateApiKeys(modelList);

            if (!keyValidation.valid) {
                // Display detailed error message based on validation results
                console.error(`\n⚠️ ${keyValidation.message}\n`);

                // If there are invalid keys, provide more specific guidance
                if (keyValidation.invalidKeys.length > 0) {
                    console.error(
                        `⚠️ The following API keys have invalid formats: ${keyValidation.invalidKeys.join(', ')}\n`
                    );
                }

                console.log(getApiKeySetupInstructions());

                // If failOnError is true, exit immediately
                if (failOnError) {
                    process.exit(1);
                }

                // Filter out models with missing or invalid keys
                const availableModels = modelList.filter(model => {
                    const requirement = MODEL_API_KEYS.find(req => req.model === model);
                    if (!requirement) return true; // Unknown model, assume it's available

                    const envVar = requirement.envVar;
                    return (
                        !keyValidation.missingKeys.includes(envVar) &&
                        !keyValidation.invalidKeys.includes(envVar)
                    );
                });

                if (availableModels.length === 0) {
                    console.error('\n❌ No models available with valid API keys.\n');
                    process.exit(1);
                }

                // Ask for confirmation before proceeding with available models
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                const confirm = await new Promise<boolean>(resolve => {
                    readline.question(
                        `Continue with available models (${availableModels.join(', ')})? (y/N): `,
                        (answer: string) => {
                            readline.close();
                            resolve(answer.toLowerCase() === 'y');
                        }
                    );
                });

                if (!confirm) {
                    console.log('Exiting...');
                    process.exit(0);
                }

                console.log(`Continuing with available models: ${availableModels.join(', ')}...`);

                // Update modelList to only include available models
                modelList.length = 0;
                modelList.push(...availableModels);
            } else {
                console.log('✅ API key validation passed.');
            }
        } catch (error) {
            // Handle unexpected errors in the validation process
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`\n❌ Error during API key validation: ${errorMessage}\n`);

            if (failOnError) {
                process.exit(1);
            }

            console.log('Continuing despite API key validation error...');
        }
    }

    // Assemble repomix options
    const repomixOptions = {
        exclude: excludeList,
        diffOnly: diff,
        tokenLimit,
        include: include?.split(','),
        ignorePatterns: ignorePatterns?.split(','),
        style,
        compress,
        removeComments,
        removeEmptyLines,
        showLineNumbers,
        headerText,
        instructionFilePath,
        topFilesLen,
        tokenCountEncoding,
    };

    // Run the review with our configured options
    const reviewOptions: TriumvirateReviewOptions = {
        models: modelList,
        exclude: excludeList as string[],
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

    // Output results to console
    for (const result of results) {
        console.log(`\n--- ${result.model.toUpperCase()} REVIEW ---`);

        if (result.metrics.error) {
            console.error(`Error: ${result.metrics.error}`);
            continue;
        }

        // Convert review to string regardless of its type
        const reviewText =
            typeof result.review === 'string'
                ? result.review
                : (result.review as any).text || JSON.stringify(result.review);

        if (summaryOnly) {
            console.log(reviewText);
        } else {
            console.log(`${reviewText.slice(0, 500)}...\n(${reviewText.length} chars total)`);
        }

        console.log(`Metrics: ${result.metrics.latency}, Cost: ${result.metrics.cost}`);
    }

    // Check if any reviews failed
    if (failOnError && results.some(r => r.metrics.error)) {
        process.exit(1);
    }
}

export async function install(context: LocalContext): Promise<void> {
    // Installation code
    console.log('Installing Triumvirate CLI...');
}

export async function uninstall(context: LocalContext): Promise<void> {
    // Uninstallation code
    console.log('Uninstalling Triumvirate CLI...');
}
