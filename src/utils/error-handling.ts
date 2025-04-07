/**
 * Error handling utilities for Triumvirate
 *
 * This module provides a centralized error handling system for the application.
 * It includes error categorization, standardized error classes, and utilities for
 * handling errors from external APIs and model providers.
 */
import type { HttpError, NetworkError } from '../types/error-types';

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
 * Custom error class for Triumvirate with improved error categorization and context
 */
export class TriumvirateError extends Error {
    category: ErrorCategory;
    component: string;
    retryable: boolean;
    originalError: unknown;
    context?: Record<string, unknown>;

    constructor(
        message: string,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        component: string = 'unknown',
        retryable: boolean = false,
        originalError: unknown = null,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'TriumvirateError';
        this.category = category;
        this.component = component;
        this.retryable = retryable;
        this.originalError = originalError;
        this.context = context;

        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, TriumvirateError.prototype);
    }

    /**
     * Get a detailed error message including category and component
     */
    getDetailedMessage(): string {
        return `[${this.category}] ${this.component}: ${this.message}`;
    }

    /**
     * Log the error with appropriate level based on category
     */
    logError(): void {
        const errorMessage = this.getDetailedMessage();

        // Log based on error category
        switch (this.category) {
            case ErrorCategory.TIMEOUT:
            case ErrorCategory.RATE_LIMIT:
            case ErrorCategory.NETWORK:
                console.warn(errorMessage);
                break;
            default:
                console.error(errorMessage);
        }

        // Log original error stack if available
        if (this.originalError instanceof Error && this.originalError.stack) {
            console.debug('Original error stack:', this.originalError.stack);
        }
    }
}

/**
 * Standardized model error interface with additional context
 * Used for errors specific to model API calls (OpenAI, Claude, Gemini)
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
 * @returns A standardized ModelError with appropriate category
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

    // Create context for error tracking
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const context = {
        modelName,
        maxRetries,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // Type guards for common error types
    const isHttpError = (err: unknown): err is { status?: number; message?: string } => {
        return typeof err === 'object' && err !== null && ('status' in err || 'message' in err);
    };

    const isNetworkError = (err: unknown): err is { code?: string; message?: string } => {
        return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
    };

    // If already a ModelError, return it
    if (error && typeof error === 'object' && 'category' in error && 'modelName' in error) {
        return error as ModelError;
    }

    // Handle timeout errors
    if (
        (error instanceof Error && error.name === 'AbortError') ||
        (isNetworkError(error) && error.code === 'ETIMEDOUT') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out')
    ) {
        return createModelError(
            `${modelName} API call timed out after ${maxRetries} retries`,
            ErrorCategory.TIMEOUT,
            modelName,
            true, // retryable
            error
        );
    }

    // Handle authentication errors (bad API key)
    if (
        (isHttpError(error) && error.status === 401) ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('API key') ||
        errorMessage.includes('auth')
    ) {
        return createModelError(
            `Invalid ${modelName} API key. Please check your API key and try again.`,
            ErrorCategory.AUTHENTICATION,
            modelName,
            false, // not retryable
            error
        );
    }

    // Handle rate limit errors
    if (
        (isHttpError(error) && error.status === 429) ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')
    ) {
        return createModelError(
            `${modelName} API rate limit exceeded. Please try again later.`,
            ErrorCategory.RATE_LIMIT,
            modelName,
            true, // retryable
            error
        );
    }

    // Handle input too large errors
    if (
        isHttpError(error) &&
        error.status === 400 &&
        (errorMessage.includes('too large') ||
            errorMessage.includes('maximum context length') ||
            errorMessage.includes('token limit'))
    ) {
        return createModelError(
            'Input is too large for the model. Please reduce the size of your input.',
            ErrorCategory.INPUT_SIZE,
            modelName,
            false, // not retryable
            error
        );
    }

    // Handle network errors
    if (
        (isNetworkError(error) &&
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code || '')) ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
    ) {
        return createModelError(
            `Network error when calling ${modelName} API. Please check your internet connection.`,
            ErrorCategory.NETWORK,
            modelName,
            true, // retryable
            error
        );
    }

    // Handle invalid response errors
    if (
        errorMessage.includes('invalid response') ||
        errorMessage.includes('unexpected response') ||
        errorMessage.includes('parsing')
    ) {
        return createModelError(
            `Received invalid response from ${modelName} API.`,
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            true, // generally retryable
            error
        );
    }

    // Handle other errors
    return createModelError(
        `${modelName} API error: ${errorMessage || 'Unknown error'}`,
        ErrorCategory.UNKNOWN,
        modelName,
        false, // by default, unknown errors are not retryable
        error
    );
}

/**
 * Handle errors from external APIs and convert them to TriumvirateError
 *
 * @param error The caught error
 * @param apiName Name of the external API (e.g., 'GitHub', 'Jira')
 * @returns A TriumvirateError with appropriate category
 */
export function handleExternalApiError(error: unknown, apiName: string): TriumvirateError {
    // If already a TriumvirateError, return it
    if (error instanceof TriumvirateError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const context = {
        apiName,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // HTTP status code based categorization
    if (error instanceof Error && 'status' in error) {
        const { status } = error as HttpError;

        switch (status) {
            case 401:
            case 403:
                return new TriumvirateError(
                    `Authentication error with ${apiName} API: ${errorMessage}`,
                    ErrorCategory.AUTHENTICATION,
                    apiName,
                    false,
                    error,
                    context
                );
            case 429:
                return new TriumvirateError(
                    `Rate limit exceeded for ${apiName} API: ${errorMessage}`,
                    ErrorCategory.RATE_LIMIT,
                    apiName,
                    true,
                    error,
                    context
                );
            case 408:
                return new TriumvirateError(
                    `Timeout error with ${apiName} API: ${errorMessage}`,
                    ErrorCategory.TIMEOUT,
                    apiName,
                    true,
                    error,
                    context
                );
        }
    }

    // Network error detection
    if (
        (error instanceof Error &&
            'code' in error &&
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(
                (error as NetworkError).code || ''
            )) ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('connection')
    ) {
        return new TriumvirateError(
            `Network error with ${apiName} API: ${errorMessage}`,
            ErrorCategory.NETWORK,
            apiName,
            true,
            error,
            context
        );
    }

    // Default to unknown error
    return new TriumvirateError(
        `Error from ${apiName} API: ${errorMessage}`,
        ErrorCategory.UNKNOWN,
        apiName,
        false,
        error,
        context
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

    return new Promise<void>(resolve => {
        // Store the timeout ID so it can be cleared if needed
        const timeoutId = setTimeout(() => {
            // Clear the timeout reference and resolve the promise
            clearTimeout(timeoutId);
            resolve();
        }, backoffMs);
    });
}

/**
 * Higher-order function to wrap API calls with standardized error handling and retry logic
 *
 * @param apiCall The API call function to execute
 * @param component The component making the call (e.g., 'OpenAI', 'Claude')
 * @param maxRetries The maximum number of retries to attempt
 * @param timeoutMs Timeout in milliseconds for the API call
 * @returns A function that executes the API call with error handling and retries
 * @throws TriumvirateError with appropriate category if all retries fail
 */
export async function withErrorHandlingAndRetry<T>(
    apiCall: (signal: AbortSignal) => Promise<T>,
    component: string,
    maxRetries = 3,
    timeoutMs = 60000
): Promise<T> {
    let retryCount = 0;
    let lastError: TriumvirateError | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // Set up timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Log attempt
            if (retryCount > 0) {
                console.log(
                    `Attempt ${retryCount + 1}/${maxRetries + 1} for ${component} API call`
                );
            }

            // Execute the API call with the abort signal
            const result = await apiCall(controller.signal);

            // Log success
            if (retryCount > 0) {
                console.log(`${component} API call succeeded after ${retryCount} retries`);
            }

            // Clear timeout before returning to prevent resource leaks
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            // Clear the timeout to prevent resource leaks
            clearTimeout(timeoutId);

            // Handle the error with our standardized approach
            lastError = categorizeModelError(error, component, maxRetries);

            // Log the error
            const errorMessage = lastError.getDetailedMessage();
            if (lastError.category === ErrorCategory.UNKNOWN) {
                console.error(errorMessage);
            } else {
                console.warn(errorMessage);
            }

            // Check if we should retry
            const shouldRetry = lastError.retryable && retryCount < maxRetries;

            if (shouldRetry) {
                console.log(
                    `${component} API call failed: ${lastError.message}. ` +
                        `Retrying (${retryCount + 1}/${maxRetries})...`
                );
                await exponentialBackoff(retryCount);
                retryCount++;
                continue;
            }

            // If we shouldn't retry or have exhausted retries, throw the error
            console.error(
                `${component} API call failed after ${retryCount} attempts: ${lastError.message}`
            );
            throw lastError;
        }
        // Removed the finally block as we're now explicitly clearing the timeout in both try and catch blocks
        // This prevents the potential double-clearing which could lead to race conditions
    }
}

/**
 * Categorizes errors from model API calls
 *
 * @param error The caught error
 * @param component The component name (e.g., 'OpenAI', 'Claude')
 * @param maxRetries Maximum retries attempted
 * @returns A TriumvirateError with appropriate category
 */
function categorizeModelError(
    error: unknown,
    component: string,
    maxRetries: number
): TriumvirateError {
    // If error is already a TriumvirateError, return it
    if (error instanceof TriumvirateError) {
        return error;
    }

    // Default error message
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Context for the error
    const context = {
        component,
        maxRetries,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // Check for timeout errors
    if (
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof Error &&
            'code' in error &&
            (error as NetworkError).code === 'ETIMEDOUT') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out')
    ) {
        return new TriumvirateError(
            `${component} API call timed out after ${maxRetries} retries`,
            ErrorCategory.TIMEOUT,
            component,
            true, // retryable
            error,
            context
        );
    }

    // Handle authentication errors (bad API key)
    if (
        (error instanceof Error && 'status' in error && error['status'] === 401) ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('API key') ||
        errorMessage.includes('auth')
    ) {
        return new TriumvirateError(
            `Invalid ${component} API key. Please check your API key and try again.`,
            ErrorCategory.AUTHENTICATION,
            component,
            false, // not retryable
            error,
            context
        );
    }

    // Handle rate limit errors
    if (
        (error instanceof Error && 'status' in error && error['status'] === 429) ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests')
    ) {
        return new TriumvirateError(
            `${component} API rate limit exceeded. Please try again later.`,
            ErrorCategory.RATE_LIMIT,
            component,
            true, // retryable
            error,
            context
        );
    }

    // Handle input too large errors
    if (
        error instanceof Error &&
        'status' in error &&
        error['status'] === 400 &&
        (errorMessage.includes('too large') ||
            errorMessage.includes('maximum context length') ||
            errorMessage.includes('token limit'))
    ) {
        // eslint-disable-next-line no-constant-condition
        return new TriumvirateError(
            'Input is too large for the model. Please reduce the size of your input.',
            ErrorCategory.INPUT_SIZE,
            component,
            false, // not retryable
            error,
            context
        );
    }

    // Handle network errors
    if (
        (error instanceof Error &&
            'code' in error &&
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(error['code'] as string)) ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
    ) {
        return new TriumvirateError(
            `Network error when calling ${component} API. Please check your internet connection.`,
            ErrorCategory.NETWORK,
            component,
            true, // retryable
            error,
            context
        );
    }

    // Handle invalid response errors
    if (
        errorMessage.includes('invalid response') ||
        errorMessage.includes('unexpected response') ||
        errorMessage.includes('parsing')
    ) {
        return new TriumvirateError(
            `Received invalid response from ${component} API.`,
            ErrorCategory.INVALID_RESPONSE,
            component,
            true, // generally retryable
            error,
            context
        );
    }

    // Handle other errors
    return new TriumvirateError(
        `${component} API error: ${errorMessage || 'Unknown error'}`,
        ErrorCategory.UNKNOWN,
        component,
        false, // by default, unknown errors are not retryable
        error,
        context
    );
}

/**
 * Safely execute a function that might throw an error
 * @param fn The function to execute
 * @param component The component name for context (or model name for model-specific functions)
 * @param defaultValue The default value to return if the function throws
 * @param isModelComponent Optional flag to indicate if this is a model component (for model-specific error handling)
 * @param logLevel Optional log level for errors (default: 'error')
 * @returns The result of the function or the default value
 */
export function safeExecute<T, D>(
    fn: () => T,
    component: string,
    defaultValue: D,
    isModelComponent: boolean = false,
    logLevel: 'error' | 'warn' | 'info' = 'error'
): T | D {
    try {
        return fn();
    } catch (error) {
        if (isModelComponent) {
            // Use model-specific error handling
            const modelError = handleModelError(
                error,
                component, // component is the model name in this case
                3 // default max retries
            );
            if (logLevel === 'error') {
                console.error(`Model error in safeExecute: ${modelError.message}`);
            } else if (logLevel === 'warn') {
                console.warn(`Model error in safeExecute: ${modelError.message}`);
            } else {
                console.info(`Model error in safeExecute: ${modelError.message}`);
            }
        } else {
            // Use general error handling
            const triumvirateError = new TriumvirateError(
                error instanceof Error ? error.message : String(error),
                ErrorCategory.UNKNOWN,
                component,
                false,
                error
            );
            triumvirateError.logError();
        }
        return defaultValue;
    }
}
// Re-export all error handling extensions
export * from './error-handling-extensions';
