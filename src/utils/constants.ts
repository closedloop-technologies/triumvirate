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
}
