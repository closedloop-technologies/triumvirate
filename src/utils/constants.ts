/**
 * Constants used throughout the application
 */
import * as fs from 'fs';
import * as path from 'path';

// API timeout settings
export const API_TIMEOUT_MS = 30000; // 30 seconds timeout

export const DEFAULT_MODELS = [
    'openai/gpt-5.5',
    'anthropic/claude-opus-4-8',
    'gemini/gemini-3.1-pro-preview',
];

// Lower-cost agent model for repo structuring and prompt generation
export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4-6';

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
 * Prefer stable models for the cheap/standard paths and frontier preview models for premium
 * code review paths where model churn is an acceptable trade-off.
 */
export const MODEL_MATRIX: Record<string, ProviderModels> = {
    openai: {
        '100k': {
            cheap: { model: 'gpt-5.4-nano' },
            standard: { model: 'gpt-5.4-mini' },
            premium: { model: 'gpt-5.5' },
        },
        '1m': {
            cheap: { model: 'gpt-5.4', fallbackFrom: 'cheap' },
            standard: { model: 'gpt-5.4' },
            premium: { model: 'gpt-5.5' },
        },
    },
    anthropic: {
        '100k': {
            cheap: { model: 'claude-haiku-4-5-20251001' },
            standard: { model: 'claude-sonnet-4-6' },
            premium: { model: 'claude-opus-4-8' },
        },
        '1m': {
            // Haiku is capped below 1M; fall back to Sonnet for the cheap 1M path.
            cheap: { model: 'claude-sonnet-4-6', fallbackFrom: 'cheap' },
            standard: { model: 'claude-sonnet-4-6' },
            premium: { model: 'claude-opus-4-8' },
        },
    },
    gemini: {
        '100k': {
            cheap: { model: 'gemini-3.1-flash-lite' },
            standard: { model: 'gemini-3.5-flash' },
            premium: { model: 'gemini-3.1-pro-preview' },
        },
        '1m': {
            cheap: { model: 'gemini-3.1-flash-lite' },
            standard: { model: 'gemini-3.5-flash' },
            premium: { model: 'gemini-3.1-pro-preview' },
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

const CURRENT_MODEL_COSTS: Array<Omit<ModelCosts, 'blended_per_million_tokens'>> = [
    {
        provider: 'openai',
        model: 'gpt-5.5',
        input: 0.000005,
        output: 0.00003,
        max_input_tokens: 1000000,
        max_output_tokens: 128000,
    },
    {
        provider: 'openai',
        model: 'gpt-5.4',
        input: 0.0000025,
        output: 0.000015,
        max_input_tokens: 1000000,
        max_output_tokens: 128000,
    },
    {
        provider: 'openai',
        model: 'gpt-5.4-mini',
        input: 0.00000075,
        output: 0.0000045,
        max_input_tokens: 400000,
        max_output_tokens: 128000,
    },
    {
        provider: 'openai',
        model: 'gpt-5.4-nano',
        input: 0.00000025,
        output: 0.0000015,
        max_input_tokens: 400000,
        max_output_tokens: 128000,
    },
    {
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        input: 0.000005,
        output: 0.000025,
        max_input_tokens: 1000000,
        max_output_tokens: 128000,
    },
    {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        input: 0.000003,
        output: 0.000015,
        max_input_tokens: 1000000,
        max_output_tokens: 64000,
    },
    {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        input: 0.000001,
        output: 0.000005,
        max_input_tokens: 200000,
        max_output_tokens: 64000,
    },
    {
        provider: 'gemini',
        model: 'gemini-3.1-pro-preview',
        input: 0.000002,
        output: 0.000012,
        max_input_tokens: 1048576,
        max_output_tokens: 65536,
    },
    {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        input: 0.0000015,
        output: 0.000009,
        max_input_tokens: 1048576,
        max_output_tokens: 65536,
    },
    {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        input: 0.00000025,
        output: 0.0000015,
        max_input_tokens: 1048576,
        max_output_tokens: 65536,
    },
];

function toModelCosts(cost: Omit<ModelCosts, 'blended_per_million_tokens'>): ModelCosts {
    return {
        ...cost,
        blended_per_million_tokens: (cost.input * 0.9 + cost.output * 0.1) * 1000000,
    };
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
        const costs = JSON.parse(costsData) as Array<Omit<ModelCosts, 'blended_per_million_tokens'>>;
        const models: Record<string, ModelCosts> = {};
        const providers = new Set<string>();
        [...costs, ...CURRENT_MODEL_COSTS].forEach(cost => {
            const normalizedCost = toModelCosts(cost);
            models[cost.provider + '/' + cost.model] = normalizedCost;
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

// Headroom to reserve for prompts and responses (tokens)
export const PROMPT_HEADROOM_TOKENS = 10000;

/**
 * Get the minimum context window size for a list of models.
 * Returns the smallest max_input_tokens among the selected models,
 * minus headroom for prompts and responses.
 * @param modelIds - Array of model IDs in "provider/model" format
 * @returns The minimum context window size minus headroom, or a default if not found
 */
export function getMinContextWindow(modelIds: string[]): number {
    const DEFAULT_CONTEXT_WINDOW = 128000; // Fallback if model not found

    let minContext = Infinity;

    for (const modelId of modelIds) {
        const modelCosts = COST_RATES[modelId];
        if (modelCosts?.max_input_tokens) {
            minContext = Math.min(minContext, modelCosts.max_input_tokens);
        } else {
            // Model not found in costs, use default
            console.warn(`Model ${modelId} not found in cost rates, using default context window`);
            minContext = Math.min(minContext, DEFAULT_CONTEXT_WINDOW);
        }
    }

    // If no models found, use default
    if (minContext === Infinity) {
        minContext = DEFAULT_CONTEXT_WINDOW;
    }

    // Subtract headroom for prompts and responses
    return Math.max(minContext - PROMPT_HEADROOM_TOKENS, 50000); // Minimum 50k tokens
}

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
