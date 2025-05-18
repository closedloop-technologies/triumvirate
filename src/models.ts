import * as dotenv from 'dotenv';

// Import only the types and utilities we still need
import type { ModelUsage } from './types/usage';
import { MODEL_API_KEYS } from './utils/api-keys';
import { MAX_API_RETRIES } from './utils/constants';
import { enhancedLogger } from './utils/enhanced-logger.js';
import { ClaudeProvider, GeminiProvider, OpenAIProvider } from './utils/llm-providers';
import { handleModelError, ErrorCategory, createModelError } from './utils/model-utils';

// Load environment variables from .env file
dotenv.config();

export function parseModelSpec(spec: string): { provider: string; model: string } {
    const [provider = '', ...rest] = spec.split('/');
    const model = rest.join('/') || '';
    return { provider: provider.toLowerCase(), model };
}

// API logger is now initialized in the CLI action

/**
 * Validates model input and API key
 * @param prompt - The prompt to validate
 * @param modelName - The provider/model specification
 * @throws ModelError if validation fails
 */
function validateModelInput(prompt: string, provider: string): void {
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
        throw createModelError(
            'Invalid prompt: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            provider,
            false,
            new Error('Invalid prompt')
        );
    }

    // Find the API key requirement for this model
    const apiKeyReq = MODEL_API_KEYS.find(req => req.model === provider.toLowerCase());
    if (!apiKeyReq) {
        throw createModelError(
            `Unknown model: ${provider}`,
            ErrorCategory.INVALID_RESPONSE,
            provider,
            false,
            new Error(`Unknown model: ${provider}`)
        );
    }

    // Validate API key
    if (!process.env[apiKeyReq.envVar]) {
        throw createModelError(
            `${apiKeyReq.envVar} is not set`,
            ErrorCategory.AUTHENTICATION,
            provider,
            false,
            new Error(`${apiKeyReq.envVar} is not set`)
        );
    }
}

/**
 * Note: The Gemini model function has been removed as part of the LLM Provider unification.
 * This functionality is now implemented in the GeminiProvider class in ./utils/llm-providers.ts
 * and accessed through the LLMProviderFactory.
 */

/**
 * Run a code review using the specified model
 * @param code - The code to review
 * @param modelName - The name of the model to use
 * @returns Promise with the review text and usage statistics
 */
export async function runModelReview(
    code: string,
    modelName: string
): Promise<{ text: string; usage: ModelUsage }> {
    // Validate model name
    if (!modelName || typeof modelName !== 'string') {
        throw createModelError(
            'Invalid model name: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            'Unknown',
            false,
            new Error('Invalid modelName parameter')
        );
    }

    // Validate code input
    if (!code || typeof code !== 'string') {
        throw createModelError(
            'Invalid code: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            false,
            new Error('Invalid code parameter')
        );
    }

    const prompt = `Please review the following codebase for bugs, design flaws, and potential improvements:\n\n${code}`;

    try {
        const { provider, model } = parseModelSpec(modelName);
        let modelProvider: OpenAIProvider | ClaudeProvider | GeminiProvider;

        if (provider === 'openai' || provider === 'openrouter' || provider === 'azure') {
            modelProvider = new OpenAIProvider(model || 'gpt-4.1');
        } else if (provider === 'claude' || provider === 'anthropic') {
            modelProvider = new ClaudeProvider(model || 'claude-3-7-sonnet-20250219');
        } else if (provider === 'gemini' || provider === 'google') {
            modelProvider = new GeminiProvider(model || 'gemini-2.5-pro-exp-03-25');
        } else {
            // Default to OpenAI-compatible provider
            modelProvider = new OpenAIProvider(model || provider);
        }

        validateModelInput(prompt, provider);
        const response = await modelProvider.runCompletion(prompt);

        return {
            text: response.data,
            usage: response.usage,
        };
    } catch (error) {
        // If error is not already logged (like from model-specific functions)
        if (!(error && typeof error === 'object' && 'category' in error)) {
            // Log the API call error
            enhancedLogger.logApiCall({
                timestamp: new Date().toISOString(),
                model: modelName,
                operation: 'completion',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        // If error is already a ModelError, rethrow it
        if (error && typeof error === 'object' && 'category' in error) {
            throw error;
        }
        // Otherwise, convert to a ModelError
        throw handleModelError(error, modelName, MAX_API_RETRIES);
    }
}
