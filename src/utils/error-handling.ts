/**
 * Error handling utilities for Triumvirate
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
        const { status } = error as any;

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
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes((error as any).code)) ||
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
    return new Promise(resolve => setTimeout(resolve, backoffMs));
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
        } finally {
            // Always clear the timeout to prevent resource leaks
            clearTimeout(timeoutId);
        }
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
        (error instanceof Error && 'code' in error && (error as any).code === 'ETIMEDOUT') ||
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
 * @param component The component name for context
 * @param defaultValue The default value to return if the function throws
 * @returns The result of the function or the default value
 */
export function safeExecute<T, D>(fn: () => T, component: string, defaultValue: D): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError = new TriumvirateError(
            error instanceof Error ? error.message : String(error),
            ErrorCategory.UNKNOWN,
            component,
            false,
            error
        );

        triumvirateError.logError();
        return defaultValue;
    }
}
