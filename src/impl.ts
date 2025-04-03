import type { LocalContext } from './context';
import { runTriumvirateReview } from './index.js';

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
  const results = await runTriumvirateReview({
    models: modelList,
    exclude: excludeList,
    diffOnly: diff,
    outputPath: output,
    failOnError,
    summaryOnly,
    tokenLimit,
    reviewType,
    repomixOptions,
  });

  // Output results to console
  for (const result of results) {
    console.log(`\n--- ${result.model.toUpperCase()} REVIEW ---`);

    if (result.metrics.error) {
      console.error(`Error: ${result.metrics.error}`);
      continue;
    }

    if (summaryOnly) {
      console.log(result.review);
    } else {
      console.log(`${result.review.slice(0, 500)}...\n(${result.review.length} chars total)`);
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
