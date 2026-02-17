/**
 * Constants used throughout the application
 */
import * as fs from 'fs';
import * as path from 'path';

// API timeout settings
export const API_TIMEOUT_MS = 30000; // 30 seconds timeout

export const DEFAULT_MODELS = [
    'openai/gpt-4.1',
    'anthropic/claude-opus-4-6',
    'gemini/gemini-3-pro-preview',
];

// Lower-cost agent model for repo structuring and prompt generation
export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4-5';

// =============================================================================
// Model Tier Selection System
// =============================================================================

export type ModelTier = 'cheap' | 'standard' | 'premium';
export type ContextSize = '100k' | '1m' | 'auto';

export interface ModelSelection {
    model: string;
    fallbackFrom?: ModelTier; // Set if auto-fallback occurred
}

export interface TierModels {
    cheap: ModelSelection;
    standard: ModelSelection;
    premium: ModelSelection;
}

export interface ProviderModels {
    '100k': TierModels;
    '1m': TierModels;
}

/**
 * Model matrix defining which models to use for each provider/tier/context combination.
 * When a model doesn't support the required context size, it falls back to premium.
 */
export const MODEL_MATRIX: Record<string, ProviderModels> = {
    openai: {
        '100k': {
            cheap: { model: 'gpt-4.1-nano' },
            standard: { model: 'gpt-4.1-mini' },
            premium: { model: 'gpt-5.2' },
        },
        '1m': {
            cheap: { model: 'gpt-4.1-nano' },
            standard: { model: 'gpt-4.1-mini' },
            premium: { model: 'gpt-4.1' },
        },
    },
    anthropic: {
        '100k': {
            cheap: { model: 'claude-haiku-4-5' },
            standard: { model: 'claude-sonnet-4-5' },
            premium: { model: 'claude-opus-4-6' },
        },
        '1m': {
            // Haiku and Sonnet don't support 1M, fallback to Opus
            cheap: { model: 'claude-opus-4-6', fallbackFrom: 'cheap' },
            standard: { model: 'claude-opus-4-6', fallbackFrom: 'standard' },
            premium: { model: 'claude-opus-4-6' },
        },
    },
    gemini: {
        '100k': {
            cheap: { model: 'gemini-2.0-flash' },
            standard: { model: 'gemini-2.5-pro' },
            premium: { model: 'gemini-3-pro-preview' },
        },
        '1m': {
            cheap: { model: 'gemini-2.0-flash' },
            standard: { model: 'gemini-2.5-pro' },
            premium: { model: 'gemini-3-pro-preview' },
        },
    },
};

/**
 * Get models for a given tier and context size.
 * Returns an array of model specs in provider/model format.
 */
export function getModelsForTier(
    tier: ModelTier,
    context: '100k' | '1m'
): { models: string[]; fallbacks: Array<{ provider: string; from: ModelTier; to: 'premium' }> } {
    const providers = ['openai', 'anthropic', 'gemini'] as const;
    const models: string[] = [];
    const fallbacks: Array<{ provider: string; from: ModelTier; to: 'premium' }> = [];

    for (const provider of providers) {
        const providerMatrix = MODEL_MATRIX[provider];
        if (!providerMatrix) continue;

        const contextMatrix = providerMatrix[context];
        if (!contextMatrix) continue;

        const selection = contextMatrix[tier];
        if (!selection) continue;

        models.push(`${provider}/${selection.model}`);

        if (selection.fallbackFrom) {
            fallbacks.push({
                provider,
                from: selection.fallbackFrom,
                to: 'premium',
            });
        }
    }

    return { models, fallbacks };
}

/**
 * Determine context size based on token count.
 * Returns '1m' if tokens exceed 100k threshold, otherwise '100k'.
 */
export function detectContextSize(tokenCount: number): '100k' | '1m' {
    const CONTEXT_THRESHOLD = 100000;
    return tokenCount > CONTEXT_THRESHOLD ? '1m' : '100k';
}

/**
 * Default tier and context settings
 */
export const DEFAULT_TIER: ModelTier = 'standard';
export const DEFAULT_CONTEXT: ContextSize = 'auto';

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
        // We need to handle both bundled (dist/) and source (src/utils/) scenarios
        const moduleURL = new URL(import.meta.url);
        const modulePath = path.dirname(moduleURL.pathname);

        // Try multiple possible paths to find llm_costs.json
        const possiblePaths = [
            path.resolve(modulePath, '../llm_costs.json'), // From dist/ (bundled)
            path.resolve(modulePath, '../../llm_costs.json'), // From src/utils/ (source)
        ];

        let costsData: string | null = null;
        for (const costsPath of possiblePaths) {
            if (fs.existsSync(costsPath)) {
                costsData = fs.readFileSync(costsPath, 'utf8');
                break;
            }
        }

        if (!costsData) {
            console.error(
                'Error loading LLM costs: llm_costs.json not found in expected locations'
            );
            return [{}, new Set<string>()];
        }
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
    MODELS: DEFAULT_MODELS,
    EXCLUDE: [],
    DIFF_ONLY: false,
    OUTPUT_PATH: './.triumvirate', // Default output path
    FAIL_ON_ERROR: false,
    SUMMARY_ONLY: false,
    TOKEN_LIMIT: 100000,
    REVIEW_TYPE: ReviewType.GENERAL,
    TIER: DEFAULT_TIER,
    CONTEXT: DEFAULT_CONTEXT,
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
