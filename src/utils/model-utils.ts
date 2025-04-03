/**
 * Shared utility functions for model error handling
 */

/**
 * Handles common model API errors and provides consistent error messages
 * @param error The error object from the API call
 * @param modelName The name of the model (openai, claude, gemini)
 * @param maxRetries The maximum number of retries attempted
 * @returns A standardized error message
 */
export function handleModelError(error: any, modelName: string, maxRetries: number): Error {
    // Handle timeout errors
    if (
        error.name === 'AbortError' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout')
    ) {
        return new Error(
            `${modelName} API call failed after ${maxRetries} retries due to timeouts`
        );
    }

    // Handle authentication errors (bad API key)
    if (
        error.status === 401 ||
        error.message?.includes('authentication') ||
        error.message?.includes('API key')
    ) {
        return new Error(`Invalid ${modelName} API key. Please check your API key and try again.`);
    }

    // Handle input too large errors
    if (
        error.status === 400 &&
        (error.message?.includes('too large') || error.message?.includes('maximum context length'))
    ) {
        return new Error('Input is too large for the model. Please reduce the size of your input.');
    }

    // Handle other errors
    return new Error(`${modelName} API error: ${error.message || 'Unknown error'}`);
}

/**
 * Implements exponential backoff for retries
 * @param retryCount Current retry attempt number
 * @returns Promise that resolves after the backoff period
 */
export async function exponentialBackoff(retryCount: number): Promise<void> {
    const backoffMs = 1000 * Math.pow(2, retryCount);
    return new Promise(resolve => setTimeout(resolve, backoffMs));
}
