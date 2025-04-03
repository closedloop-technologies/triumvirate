import type { LocalContext } from './context';
import { runTriumvirateReview } from './index';
import type { TriumvirateReviewOptions } from './index';
import { validateApiKeys, getApiKeySetupInstructions } from './utils/api-keys';

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
        const keyValidation = validateApiKeys(modelList);

        if (!keyValidation.valid) {
            console.error(`\n⚠️ ${keyValidation.message}\n`);
            console.log(getApiKeySetupInstructions());

            if (failOnError) {
                process.exit(1);
            }

            // Ask for confirmation before proceeding
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const confirm = await new Promise<boolean>(resolve => {
                readline.question('Do you want to continue anyway? (y/N): ', (answer: string) => {
                    readline.close();
                    resolve(answer.toLowerCase() === 'y');
                });
            });

            if (!confirm) {
                console.log('Exiting...');
                process.exit(0);
            }

            console.log('Continuing without all API keys...');
        } else {
            console.log('✅ API key validation passed.');
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
