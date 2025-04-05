/**
 * Shared utility functions for model error handling
 */

/**
 * Error categories for better error handling and reporting
 */
export enum ErrorCategory {
    TIMEOUT = 'timeout',
    AUTHENTICATION = 'authentication',
    RATE_LIMIT = 'rate_limit',
    INPUT_SIZE = 'input_size',
    NETWORK = 'network',
    INVALID_RESPONSE = 'invalid_response',
    UNKNOWN = 'unknown',
}

/**
 * Standardized error object with additional context
 */
export interface ModelError extends Error {
    category: ErrorCategory;
    modelName: string;
    retryable: boolean;
    originalError?: unknown;
}

/**
 * Create a standardized model error with additional context
 * @param message Error message
 * @param category Error category
 * @param modelName The name of the model (openai, claude, gemini)
 * @param retryable Whether this error can be retried
 * @param originalError The original error object
 * @returns A standardized ModelError
 */
export function createModelError(
    message: string,
    category: ErrorCategory,
    modelName: string,
    retryable: boolean,
    originalError?: unknown
): ModelError {
    const error = new Error(message) as ModelError;
    error.category = category;
    error.modelName = modelName;
    error.retryable = retryable;
    error.originalError = originalError;
    error.name = 'ModelError';
    return error;
}

/**
 * Handles common model API errors and provides consistent error messages
 * @param error The error object from the API call
 * @param modelName The name of the model (openai, claude, gemini)
 * @param maxRetries The maximum number of retries attempted
 * @returns A standardized error message
 */
export function handleModelError(
    error: unknown,
    modelName: string,
    maxRetries: number
): ModelError {
    // Log the original error for debugging
    console.debug(`Original ${modelName} error:`, error);

    // Extract error message safely
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Create a type guard for HTTP-like errors
    const isHttpError = (err: unknown): err is { status?: number; message?: string } => {
        return typeof err === 'object' && err !== null && ('status' in err || 'message' in err);
    };

    // Create a type guard for network-like errors
    const isNetworkError = (err: unknown): err is { code?: string; message?: string } => {
        return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
    };

    // Handle timeout errors
    if (
        (error instanceof Error && error.name === 'AbortError') ||
        (isNetworkError(error) && error.code === 'ETIMEDOUT') ||
        (error instanceof Error && error.message.includes('timeout')) ||
        (error instanceof Error && error.message.includes('timed out'))
    ) {
        return createModelError(
            `${modelName} API call failed after ${maxRetries} retries due to timeouts`,
            ErrorCategory.TIMEOUT,
            modelName,
            true,
            error
        );
    }

    // Handle authentication errors (bad API key)
    if (
        (isHttpError(error) && error.status === 401) ||
        (error instanceof Error && error.message.includes('authentication')) ||
        (error instanceof Error && error.message.includes('API key')) ||
        (error instanceof Error && error.message.includes('auth'))
    ) {
        return createModelError(
            `Invalid ${modelName} API key. Please check your API key and try again.`,
            ErrorCategory.AUTHENTICATION,
            modelName,
            false,
            error
        );
    }

    // Handle rate limit errors
    if (
        (isHttpError(error) && error.status === 429) ||
        (error instanceof Error && error.message.includes('rate limit')) ||
        (error instanceof Error && error.message.includes('too many requests'))
    ) {
        return createModelError(
            `${modelName} API rate limit exceeded. Please try again later.`,
            ErrorCategory.RATE_LIMIT,
            modelName,
            true,
            error
        );
    }

    // Handle input too large errors
    if (
        isHttpError(error) &&
        error.status === 400 &&
        ((error instanceof Error && error.message.includes('too large')) ||
            (error instanceof Error && error.message.includes('maximum context length')) ||
            (error instanceof Error && error.message.includes('token limit')))
    ) {
        return createModelError(
            'Input is too large for the model. Please reduce the size of your input.',
            ErrorCategory.INPUT_SIZE,
            modelName,
            false,
            error
        );
    }

    // Handle network errors
    if (
        (isNetworkError(error) &&
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code || '')) ||
        (error instanceof Error && error.message.includes('network')) ||
        (error instanceof Error && error.message.includes('connection'))
    ) {
        return createModelError(
            `Network error when calling ${modelName} API. Please check your internet connection.`,
            ErrorCategory.NETWORK,
            modelName,
            true,
            error
        );
    }

    // Handle invalid response errors
    if (
        error instanceof Error &&
        (error.message.includes('invalid response') ||
            error.message.includes('unexpected response') ||
            error.message.includes('parsing'))
    ) {
        return createModelError(
            `Received invalid response from ${modelName} API.`,
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            true,
            error
        );
    }

    // Handle other errors
    return createModelError(
        `${modelName} API error: ${errorMessage}`,
        ErrorCategory.UNKNOWN,
        modelName,
        false,
        error
    );
}

/**
 * Implements exponential backoff for retries
 * @param retryCount Current retry attempt number
 * @returns Promise that resolves after the backoff period
 */
export async function exponentialBackoff(retryCount: number): Promise<void> {
    const backoffMs = 1000 * Math.pow(2, retryCount);
    console.log(`Backing off for ${backoffMs}ms before retry`);
    return new Promise(resolve => setTimeout(resolve, backoffMs));
}

/**
 * Higher-order function to wrap API calls with shared error handling and retry logic
 * @param apiCall The API call function to execute
 * @param modelName The name of the model (openai, claude, gemini)
 * @param maxRetries The maximum number of retries to attempt
 * @param timeoutMs Timeout in milliseconds for the API call
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
            // Log attempt
            if (retryCount > 0) {
                console.log(
                    `Attempt ${retryCount + 1}/${maxRetries + 1} for ${modelName} API call`
                );
            }

            // Execute the API call with the abort signal
            const result = await apiCall(controller.signal);

            // Log success
            if (retryCount > 0) {
                console.log(`${modelName} API call succeeded after ${retryCount} retries`);
            }

            return result;
        } catch (error: any) {
            // Clear the timeout to prevent resource leaks
            clearTimeout(timeoutId);

            // Handle retryable errors
            const modelError = handleModelError(error, modelName, maxRetries);

            // Check if we should retry
            const shouldRetry = modelError.retryable && retryCount < maxRetries;

            if (shouldRetry) {
                console.log(
                    `${modelName} API call failed with error: ${modelError.message}. ` +
                        `Retrying (${retryCount + 1}/${maxRetries})...`
                );
                await exponentialBackoff(retryCount);
                retryCount++;
                continue;
            }

            // If we shouldn't retry or have exhausted retries, throw the error
            console.error(`${modelName} API call failed: ${modelError.message}`);
            throw modelError;
        } finally {
            // Always clear the timeout to prevent resource leaks
            clearTimeout(timeoutId);
        }
    }
}

/**
 * Safely executes a function that might throw an error
 * @param fn The function to execute
 * @param defaultValue The default value to return if the function throws
 * @returns The result of the function or the default value
 */
export function safeExecute<T, D>(fn: () => T, defaultValue: D): T | D {
    try {
        return fn();
    } catch (error) {
        console.error('Error in safeExecute:', error);
        return defaultValue;
    }
}
