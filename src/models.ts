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

// API logger is now initialized in the CLI action

/**
 * Validates model input and API key
 * @param prompt - The prompt to validate
 * @param modelName - The name of the model
 * @throws ModelError if validation fails
 */
function validateModelInput(prompt: string, modelName: string): void {
    // Validate input
    if (!prompt || typeof prompt !== 'string') {
        throw createModelError(
            'Invalid prompt: must be a non-empty string',
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            false,
            new Error('Invalid prompt')
        );
    }

    // Find the API key requirement for this model
    const apiKeyReq = MODEL_API_KEYS.find(req => req.model === modelName.toLowerCase());
    if (!apiKeyReq) {
        throw createModelError(
            `Unknown model: ${modelName}`,
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            false,
            new Error(`Unknown model: ${modelName}`)
        );
    }

    // Validate API key
    if (!process.env[apiKeyReq.envVar]) {
        throw createModelError(
            `${apiKeyReq.envVar} is not set`,
            ErrorCategory.AUTHENTICATION,
            modelName,
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
        // Convert model name to provider name (case insensitive)
        const normalizedModelName = modelName.toLowerCase();
        let modelProvider = null;
        if (normalizedModelName === 'openai') {
            modelProvider = new OpenAIProvider();
        } else if (normalizedModelName === 'claude') {
            modelProvider = new ClaudeProvider();
        } else if (normalizedModelName === 'gemini') {
            modelProvider = new GeminiProvider();
        } else {
            throw Error('Unsupported model');
        }

        // Use the provider factory to run the completion
        validateModelInput(prompt, modelName);
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
