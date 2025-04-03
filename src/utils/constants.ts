/**
 * Constants used throughout the application
 */

// API timeout settings
export const API_TIMEOUT_MS = 30000; // 30 seconds timeout

// Cost estimation rates ($ per 1K tokens)
export const COST_RATES = {
    openai: {
        input: 0.00001, // $0.01 per 1K tokens
        output: 0.00003, // $0.03 per 1K tokens
    },
    claude: {
        input: 0.00000325, // $0.00325 per 1K tokens
        output: 0.00001625, // $0.01625 per 1K tokens
    },
    gemini: {
        input: 0.000000625, // $0.000625 per 1K tokens
        output: 0.000001875, // $0.001875 per 1K tokens
    },
};

// Maximum number of retries for API calls
export const MAX_API_RETRIES = 3;

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
    MODELS: ['openai', 'claude', 'gemini'],
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
