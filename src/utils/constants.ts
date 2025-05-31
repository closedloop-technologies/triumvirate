/**
 * Constants used throughout the application
 */
import * as fs from 'fs';
import * as path from 'path';

// API timeout settings
export const API_TIMEOUT_MS = 30000; // 30 seconds timeout

// Cost estimation rates ($ per 1M tokens)
// https://ai.google.dev/gemini-api/docs/pricing
// Run ./update_costs.sh`
// Update Coosts from ./llm_costs.json

export interface ModelCosts {
    provider: string;
    model: string;
    input: number;
    output: number;
    blended_per_million_tokens: number;
    max_input_tokens: number;
    max_output_tokens: number;
}

// Get costs from the JSON file, using a relative path that works regardless of where the code is executed from
const getLLMCosts = (): [Record<string, ModelCosts>, Set<string>] => {
    try {
        // Resolve path relative to this file using import.meta.url (ES modules approach)
        const moduleURL = new URL(import.meta.url);
        const modulePath = path.dirname(moduleURL.pathname);
        const costsPath = path.resolve(modulePath, '../../llm_costs.json');
        const costsData = fs.readFileSync(costsPath, 'utf8');
        const costs = JSON.parse(costsData);
        const models: Record<string, ModelCosts> = {};
        const providers = new Set<string>();
        costs.forEach((cost: ModelCosts) => {
            models[cost.provider + '/' + cost.model] = {
                provider: cost.provider,
                model: cost.model,
                input: cost.input,
                output: cost.output,
                blended_per_million_tokens: (cost.input * 0.9 + cost.output * 0.1) * 1000000,
                max_input_tokens: cost.max_input_tokens,
                max_output_tokens: cost.max_output_tokens,
            };
            providers.add(cost.provider);
        });
        return [models, providers];
    } catch (error) {
        console.error('Error loading LLM costs:', error);
        return [{}, new Set<string>()];
    }
};

export const [COST_RATES, PROVIDERS] = getLLMCosts();

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
    OUTPUT_PATH: './.triumvirate', // Default output path
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
