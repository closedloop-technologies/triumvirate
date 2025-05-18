/**
 * Constants used throughout the application
 */

// API timeout settings
export const API_TIMEOUT_MS = 30000; // 30 seconds timeout

// Cost estimation rates ($ per 1M tokens)
// https://ai.google.dev/gemini-api/docs/pricing
// Run ./update_costs.sh
// Update Coosts from ./llm_costs.json
export const COST_RATES = {
    openai: {
        input: 0.000002,
        output: 0.000008,
    },
    anthropic: {
        input: 0.000003, // $3 per 1M tokens (text / image / video)
        output: 0.000015, // $15 per 1M tokens (text / image / video)
    },
    google: {
        // Currently free, but we're assuming a price of https://ai.google.dev/gemini-api/docs/pricing
        input: 0.0, // $0.10 per 1M tokens (text / image / video)
        output: 0.0, // $0.40 per 1M tokens (text / image / video)
    },
};

/**
 * Maximum context window sizes for supported models
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
    openai: 128000,
    claude: 200000,
    gemini: 2000000,
};

/**
 * Determine the smallest context window for the given models
 */
export function getDynamicTokenLimit(models: string[]): number {
    const limits = models.map(
        model => MODEL_CONTEXT_WINDOWS[model.toLowerCase()] ?? DEFAULT_REVIEW_OPTIONS.TOKEN_LIMIT
    );
    return Math.min(...limits);
}

// Maximum number of retries for API calls
export const MAX_API_RETRIES = 3;

/**
 * Maximum number of files to exclude during repomix optimization
 */
export const MAX_FILES_TO_EXCLUDE = 3;

// Review types
export enum ReviewType {
    GENERAL = 'general',
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    ARCHITECTURE = 'architecture',
    DOCS = 'docs',
}

// Default values for triumvirate review options
export const DEFAULT_REVIEW_OPTIONS = {
    MODELS: [
        'openai/gpt-4.1',
        'anthropic/claude-3-7-sonnet-20250219',
        'google/gemini-2.5-pro-exp-03-25',
    ],
    EXCLUDE: [],
    DIFF_ONLY: false,
    OUTPUT_PATH: '.',
    FAIL_ON_ERROR: false,
    SUMMARY_ONLY: false,
    TOKEN_LIMIT: 100000,
    REVIEW_TYPE: ReviewType.GENERAL,
};

// Default values for repomix options
export const DEFAULT_REPOMIX_OPTIONS = {
    STYLE: 'xml',
    COMPRESS: true,
    REMOVE_COMMENTS: false,
    REMOVE_EMPTY_LINES: false,
    SHOW_LINE_NUMBERS: false,
    TOP_FILES_LEN: 20,
    TOKEN_COUNT_ENCODING: 'o200k_base',
};
