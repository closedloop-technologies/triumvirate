/**
 * BAML Providers Module
 *
 * This module provides a wrapper around BAML-generated functions to maintain
 * compatibility with the existing LLMProvider interface and LLMResponse type.
 */

import { COST_RATES } from './constants.js';
import { enhancedLogger } from './enhanced-logger.js';
import type { LLMResponse, LLMUsage } from './llm-providers.js';
import { b } from '../../baml_client/index.js';
import type {
    CategoryResponse,
    FindingsResponse,
    InsightsResponse,
    PlanResponse,
    PrioritizedResponse,
} from '../../baml_client/types.js';

/**
 * Estimate cost based on model and token counts
 * Note: BAML doesn't expose token counts directly, so we estimate based on character count
 */
function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}

/**
 * Get cost rate for a model
 */
function getCostRate(model: string): { input: number; output: number } {
    const rates = COST_RATES[model];
    if (rates) {
        return { input: rates.input, output: rates.output };
    }
    // Default rates if model not found
    return { input: 0.003, output: 0.015 };
}

/**
 * Create a mock usage object since BAML doesn't expose token counts
 * In production, you'd use BAML's event hooks to capture actual usage
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
 * Log an API call for tracking
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
 * Review code using BAML
 */
export async function reviewCodeWithBAML(code: string): Promise<LLMResponse<string>> {
    const model = 'baml-fallback'; // Using fallback strategy
    try {
        const result = await b.ReviewCode(code);
        const usage = createMockUsage(code, result);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

        logApiCall(model, 'completion', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(code, '');
        logApiCall(model, 'completion', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract categories using BAML
 */
export async function extractCategoriesWithBAML(
    reviews: string
): Promise<LLMResponse<CategoryResponse>> {
    const model = 'baml-fallback';
    try {
        const result = await b.ExtractCategories(reviews);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(reviews, outputStr);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

        logApiCall(model, 'categories', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(reviews, '');
        logApiCall(model, 'categories', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract findings using BAML
 */
export async function extractFindingsWithBAML(
    reviews: string,
    categories: string,
    models: string
): Promise<LLMResponse<FindingsResponse>> {
    const model = 'baml-fallback';
    const inputText = `${reviews}\n${categories}\n${models}`;
    try {
        const result = await b.ExtractFindings(reviews, categories, models);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

        logApiCall(model, 'findings', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'findings', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Generate model insights using BAML
 */
export async function generateInsightsWithBAML(
    reviews: string,
    models: string
): Promise<LLMResponse<InsightsResponse>> {
    const model = 'baml-fallback';
    const inputText = `${reviews}\n${models}`;
    try {
        const result = await b.GenerateInsights(reviews, models);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

        logApiCall(model, 'insights', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(inputText, '');
        logApiCall(model, 'insights', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Extract priorities using BAML
 */
export async function extractPrioritiesWithBAML(
    findings: string
): Promise<LLMResponse<PrioritizedResponse>> {
    const model = 'baml-fallback';
    try {
        const result = await b.ExtractPriorities(findings);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(findings, outputStr);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

        logApiCall(model, 'priorities', usage, true, cost);

        return { data: result, usage, cost };
    } catch (error) {
        const usage = createMockUsage(findings, '');
        logApiCall(model, 'priorities', usage, false, 0, String(error));
        throw error;
    }
}

/**
 * Generate task plan using BAML
 */
export async function generatePlanWithBAML(
    summary: string,
    task?: string
): Promise<LLMResponse<PlanResponse>> {
    const model = 'baml-fallback';
    const inputText = task ? `${summary}\n${task}` : summary;
    try {
        const result = await b.GeneratePlan(summary, task ?? null);
        const outputStr = JSON.stringify(result);
        const usage = createMockUsage(inputText, outputStr);
        const rates = getCostRate('claude-3-7-sonnet-20250219');
        const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000;

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
 * Check if BAML should be used instead of direct SDK calls
 */
export function useBAML(): boolean {
    return process.env['USE_BAML'] === 'true';
}
