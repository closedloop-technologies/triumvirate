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

/**
 * Higher-order function to wrap API calls with shared error handling and retry logic
 * @param apiCall The API call function to execute
 * @param modelName The name of the model (openai, claude, gemini)
 * @param maxRetries The maximum number of retries to attempt
 * @returns A function that executes the API call with error handling and retries
 */
export async function withErrorHandlingAndRetry<T>(
    apiCall: (signal: AbortSignal) => Promise<T>,
    modelName: string,
    maxRetries = 3,
    timeoutMs = 60000
): Promise<T> {
    let retryCount = 0;
    
    while (true) {
        // Set up timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            // Execute the API call with the abort signal
            return await apiCall(controller.signal);
        } catch (error: any) {
            // Handle timeout errors with retry logic
            if (
                (error.name === 'AbortError' ||
                error.code === 'ETIMEDOUT' ||
                error.message?.includes('timeout')) &&
                retryCount < maxRetries
            ) {
                console.log(`${modelName} API call timed out. Retrying (${retryCount + 1}/${maxRetries})...`);
                await exponentialBackoff(retryCount);
                retryCount++;
                continue;
            }
            
            // Use the shared error handler for all other errors
            throw handleModelError(error, modelName, maxRetries);
        } finally {
            // Always clear the timeout to prevent resource leaks
            clearTimeout(timeoutId);
        }
    }
}
