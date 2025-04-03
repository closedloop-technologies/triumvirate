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
 * @param usage - Usage data to check
 * @returns True if the usage data is from OpenAI
 */
export function isOpenAIUsage(usage: ModelUsage | Record<string, unknown>): usage is OpenAIUsage {
    // First check if it has the required base properties
    if (!('input_tokens' in usage && 'output_tokens' in usage && 'total_tokens' in usage)) {
        return false;
    }
    
    return (
        'input_tokens_details' in usage ||
        ('input_tokens' in usage && !('promptTokenCount' in usage) && !('prompt_tokens' in usage))
    );
}

/**
 * Type guard to check if usage is from Claude
 * @param usage - Usage data to check
 * @returns True if the usage data is from Claude
 */
export function isClaudeUsage(usage: ModelUsage | Record<string, unknown>): usage is ClaudeUsage {
    // First check if it has the required base properties
    if (!('input_tokens' in usage && 'output_tokens' in usage && 'total_tokens' in usage)) {
        return false;
    }
    
    return 'prompt_tokens' in usage || 'completion_tokens' in usage;
}

/**
 * Type guard to check if usage is from Gemini
 * @param usage - Usage data to check
 * @returns True if the usage data is from Gemini
 */
export function isGeminiUsage(usage: ModelUsage | Record<string, unknown>): usage is GeminiUsage {
    // First check if it has the required base properties
    if (!('input_tokens' in usage && 'output_tokens' in usage && 'total_tokens' in usage)) {
        return false;
    }
    
    return (
        'promptTokenCount' in usage || 'candidatesTokenCount' in usage || 'totalTokenCount' in usage
    );
}

/**
 * Normalize usage data from any model to a standard format
 * @param usage - Usage data from any supported model or unknown format
 * @returns Normalized usage data with standardized token counts
 */
export function normalizeUsage(usage: ModelUsage | Record<string, unknown>): BaseUsage {
    if (!usage) {
        return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    }

    // Cast to allow safe property access with type checking
    const data = usage as Record<string, unknown>;

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
    const inputTokens = 
        (typeof data['input_tokens'] === 'number' ? data['input_tokens'] : 0) || 
        (typeof data['prompt_tokens'] === 'number' ? data['prompt_tokens'] : 0) || 
        (typeof data['promptTokenCount'] === 'number' ? data['promptTokenCount'] : 0) || 
        0;
        
    const outputTokens = 
        (typeof data['output_tokens'] === 'number' ? data['output_tokens'] : 0) || 
        (typeof data['completion_tokens'] === 'number' ? data['completion_tokens'] : 0) || 
        (typeof data['candidatesTokenCount'] === 'number' ? data['candidatesTokenCount'] : 0) || 
        0;
        
    const totalTokens = 
        (typeof data['total_tokens'] === 'number' ? data['total_tokens'] : 0) || 
        (typeof data['totalTokenCount'] === 'number' ? data['totalTokenCount'] : 0) || 
        (inputTokens + outputTokens);
        
    return {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens
    };
}
