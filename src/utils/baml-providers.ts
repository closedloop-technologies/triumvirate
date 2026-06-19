/**
 * BAML Providers Module
 *
 * This module provides a wrapper around BAML-generated functions to maintain
 * compatibility with the existing LLMProvider interface and LLMResponse type.
 */

import { COST_RATES, DEFAULT_AGENT_MODEL, DEFAULT_MODELS } from './constants.js';
import { enhancedLogger } from './enhanced-logger.js';
import type { LLMResponse, LLMUsage } from './llm-providers.js';
import { b } from '../../baml_client/index.js';
import type {
    CategoryResponse,
    CompressionRecommendation,
    FindingsResponse,
    InsightsResponse,
    PlanResponse,
    PrioritizedResponse,
} from '../../baml_client/types.js';

const DEFAULT_OPENAI_REVIEW_MODEL = DEFAULT_MODELS.find(model => model.startsWith('openai/')) ?? 'openai/gpt-5.5';
const DEFAULT_CLAUDE_REVIEW_MODEL = DEFAULT_MODELS.find(model => model.startsWith('anthropic/')) ?? 'anthropic/claude-opus-4-8';
const DEFAULT_GEMINI_REVIEW_MODEL = DEFAULT_MODELS.find(model => model.startsWith('gemini/')) ?? 'gemini/gemini-3.1-pro-preview';

/**
 * Estimate cost based on model and token counts.
 * Note: BAML doesn't expose token counts directly yet, so usage is estimated
 * from character counts. Keep this estimate internally consistent with COST_RATES.
 */
function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}

/**
 * Get cost rate for a model.
 */
function getCostRate(model: string): { input: number; output: number } {
    // Try exact match first
    let rates = COST_RATES[model];

    if (!rates) {
        // Search for the model in all entries (handles provider/model format)
        for (const key of Object.keys(COST_RATES)) {
            if (key.endsWith('/' + model) || model.endsWith('/' + COST_RATES[key]?.model)) {
                rates = COST_RATES[key];
                break;
            }
        }
    }

    if (rates && rates.input !== undefined && rates.output !== undefined) {
        return { input: rates.input, output: rates.output };
    }
    // Default rates if model not found (Claude Sonnet pricing)
    return { input: 0.000003, output: 0.000015 };
}

function calculateCost(model: string, usage: LLMUsage): number {
    const rates = getCostRate(model);
    return usage.input_tokens * rates.input + usage.output_tokens * rates.output;
}

/**
 * Create a mock usage object since BAML doesn't expose token counts.
 * In production, use BAML event hooks to capture actual usage.
 */
function createMockUsage(inputText: string, outputText: string): LLMUsage {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    return {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
    };
}

/**
 * Log an API call for tracking.
 */
function logApiCall(
    model: string,
    operation: string,
    usage: LLMUsage,
    success: boolean,
    cost: number,
    error?: string
): void {
    enhancedLogger.logApiCall({
        timestamp: new Date().toISOString(),
        model,
        operation,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
        success,
        cost,
        error,
    });
}

// =============================================================================
// BAML Function Wrappers
// =============================================================================

/**
 * Review code using BAML fallback strategy.
 */
export async function reviewCodeWithBAML(code: string): Promise<LLMResponse<string>> {
    const model = DEFAULT_AGENT_MODEL;
    try {
        const result = await b.ReviewCode(code);
        const usage = createMockUsage(code, result);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'completion', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(code, '');
        logApiCall(model, 'completion', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract categories using BAML.
 */
export async function extractCategoriesWithBAML(
    reviews: string
): Promise<LLMResponse<CategoryResponse>> {
    const model = DEFAULT_AGENT_MODEL;
    try {
        const result = await b.ExtractCategories(reviews);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(reviews, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'categories', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(reviews, '');
        logApiCall(model, 'categories', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract findings using BAML.
 */
export async function extractFindingsWithBAML(
    reviews: string,
    categories: string,
    models: string
): Promise<LLMResponse<FindingsResponse>> {
    const model = DEFAULT_AGENT_MODEL;
    const inputText = `${reviews}\n${categories}\n${models}`;
    try {
        const result = await b.ExtractFindings(reviews, categories, models);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'findings', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'findings', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Generate model insights using BAML.
 */
export async function generateInsightsWithBAML(
    reviews: string,
    models: string
): Promise<LLMResponse<InsightsResponse>> {
    const model = DEFAULT_AGENT_MODEL;
    const inputText = `${reviews}\n${models}`;
    try {
        const result = await b.GenerateInsights(reviews, models);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'insights', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'insights', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract priorities using BAML.
 */
export async function extractPrioritiesWithBAML(
    findings: string
): Promise<LLMResponse<PrioritizedResponse>> {
    const model = DEFAULT_AGENT_MODEL;
    try {
        const result = await b.ExtractPriorities(findings);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(findings, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'priorities', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(findings, '');
        logApiCall(model, 'priorities', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Generate task plan using BAML.
 */
export async function generatePlanWithBAML(
    summary: string,
    task?: string
): Promise<LLMResponse<PlanResponse>> {
    const model = DEFAULT_AGENT_MODEL;
    const inputText = task ? `${summary}\n${task}` : summary;
    try {
        const result = await b.GeneratePlan(summary, task ?? null);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'plan', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'plan', usage, false, 0, String(error));
        throw error;
    }
}

// =============================================================================
// Feature Flag
// =============================================================================

/**
 * Check if BAML should be used instead of direct SDK calls.
 * @deprecated BAML is now the default - this flag will be removed in a future version.
 */
export function useBAML(): boolean {
    // BAML is now always enabled - the flag is kept for backward compatibility
    return process.env['USE_BAML'] !== 'false';
}

// =============================================================================
// Per-Model Review Functions (for parallel triumvirate execution)
// =============================================================================

/**
 * Review code using Claude via BAML.
 */
export async function reviewCodeWithClaude(code: string): Promise<LLMResponse<string>> {
    const model = DEFAULT_CLAUDE_REVIEW_MODEL;
    try {
        const result = await b.ReviewCodeWithClaude(code);
        const usage = createMockUsage(code, result);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'completion', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(code, '');
        logApiCall(model, 'completion', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Review code using GPT via BAML.
 */
export async function reviewCodeWithGPT(code: string): Promise<LLMResponse<string>> {
    const model = DEFAULT_OPENAI_REVIEW_MODEL;
    try {
        const result = await b.ReviewCodeWithGPT(code);
        const usage = createMockUsage(code, result);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'completion', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(code, '');
        logApiCall(model, 'completion', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Review code using Gemini via BAML.
 */
export async function reviewCodeWithGemini(code: string): Promise<LLMResponse<string>> {
    const model = DEFAULT_GEMINI_REVIEW_MODEL;
    try {
        const result = await b.ReviewCodeWithGemini(code);
        const usage = createMockUsage(code, result);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'completion', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(code, '');
        logApiCall(model, 'completion', usage, false, 0, String(error));
        throw error;
    }
}

// =============================================================================
// Smart Compression Function
// =============================================================================

/**
 * Get compression recommendation using BAML.
 */
export async function recommendCompressionWithBAML(
    directoryStructure: string,
    fileTokenCounts: string,
    totalTokens: number,
    tokenLimit: number,
    task: string
): Promise<LLMResponse<CompressionRecommendation>> {
    const model = DEFAULT_AGENT_MODEL;
    const inputText = `${directoryStructure}\n${fileTokenCounts}\n${totalTokens}\n${tokenLimit}\n${task}`;
    try {
        const result = await b.RecommendCompression(
            directoryStructure,
            fileTokenCounts,
            totalTokens,
            tokenLimit,
            task || 'General code review'
        );
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const cost = calculateCost(model, usage);

        logApiCall(model, 'compression', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'compression', usage, false, 0, String(error));
        throw error;
    }
}
