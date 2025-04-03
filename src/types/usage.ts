/**
 * Types for usage data returned by different LLM providers
 */

// Base usage interface that all model usages will implement
export interface BaseUsage {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
}

// OpenAI specific usage data
export interface OpenAIUsage extends BaseUsage {
    input_tokens_details?: {
        cached_tokens: number;
    };
    output_tokens_details?: {
        reasoning_tokens: number;
    };
}

// Claude specific usage data
export interface ClaudeUsage extends BaseUsage {
    prompt_tokens?: number; // Alias for input_tokens
    completion_tokens?: number; // Alias for output_tokens
}

// Gemini specific usage data
export interface GeminiUsage extends BaseUsage {
    promptTokenCount?: number; // Alias for input_tokens
    candidatesTokenCount?: number; // Alias for output_tokens
    totalTokenCount?: number; // Alias for total_tokens
}

// Union type for all possible usage formats
export type ModelUsage = OpenAIUsage | ClaudeUsage | GeminiUsage;

/**
 * Type guard to check if usage is from OpenAI
 */
export function isOpenAIUsage(usage: ModelUsage): usage is OpenAIUsage {
    return (
        'input_tokens_details' in usage ||
        ('input_tokens' in usage && !('promptTokenCount' in usage) && !('prompt_tokens' in usage))
    );
}

/**
 * Type guard to check if usage is from Claude
 */
export function isClaudeUsage(usage: ModelUsage): usage is ClaudeUsage {
    return 'prompt_tokens' in usage || 'completion_tokens' in usage;
}

/**
 * Type guard to check if usage is from Gemini
 */
export function isGeminiUsage(usage: ModelUsage): usage is GeminiUsage {
    return (
        'promptTokenCount' in usage || 'candidatesTokenCount' in usage || 'totalTokenCount' in usage
    );
}

/**
 * Normalize usage data from any model to a standard format
 */
export function normalizeUsage(usage: ModelUsage | any): BaseUsage {
    if (!usage) {
        return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    }

    if (isOpenAIUsage(usage)) {
        return {
            input_tokens: usage.input_tokens || 0,
            output_tokens: usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 0,
        };
    }

    if (isClaudeUsage(usage)) {
        return {
            input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
            output_tokens: usage.output_tokens || usage.completion_tokens || 0,
            total_tokens:
                usage.total_tokens ||
                (usage.prompt_tokens && usage.completion_tokens
                    ? usage.prompt_tokens + usage.completion_tokens
                    : 0),
        };
    }

    if (isGeminiUsage(usage)) {
        return {
            input_tokens: usage.input_tokens || usage.promptTokenCount || 0,
            output_tokens: usage.output_tokens || usage.candidatesTokenCount || 0,
            total_tokens: usage.total_tokens || usage.totalTokenCount || 0,
        };
    }

    // Handle unknown usage format by extracting any token counts we can find
    return {
        input_tokens: usage.input_tokens || usage.prompt_tokens || usage.promptTokenCount || 0,
        output_tokens:
            usage.output_tokens || usage.completion_tokens || usage.candidatesTokenCount || 0,
        total_tokens: usage.total_tokens || usage.totalTokenCount || 0,
    };
}
