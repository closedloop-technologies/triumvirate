/**
 * Consolidated Error Handling Utilities for Triumvirate
 *
 * This module provides a centralized error handling system for the application.
 * It includes error categorization, standardized error classes, and utilities for
 * handling errors from external APIs, model providers, file operations, data processing,
 * and report generation.
 */
import type { HttpError, NetworkError } from '../types/error-types'; // Keep this import

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
    FILE_SYSTEM = 'file_system', // Added category
    DATA_PROCESSING = 'data_processing', // Added category
    REPORT_GENERATION = 'report_generation', // Added category
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
    logError(
        logger: {
            error: (...args: unknown[]) => void;
            warn: (...args: unknown[]) => void;
            debug: (...args: unknown[]) => void;
        } = console
    ): void {
        const errorMessage = this.getDetailedMessage();

        // Log based on error category
        switch (this.category) {
            case ErrorCategory.TIMEOUT:
            case ErrorCategory.RATE_LIMIT:
            case ErrorCategory.NETWORK:
                logger.warn(errorMessage);
                break;
            default:
                logger.error(errorMessage);
        }

        // Log original error stack if available for debugging
        if (this.originalError instanceof Error && this.originalError.stack) {
            logger.debug('Original error stack:', this.originalError.stack);
        }
        if (this.context) {
            logger.debug('Error context:', this.context);
        }
    }
}

/**
 * Standardized model error interface with additional context
 * Used for errors specific to model API calls (OpenAI, Claude, Gemini)
 */
export interface ModelError extends TriumvirateError {
    // Inherit from TriumvirateError
    modelName: string; // Keep specific property if needed, though component could cover this
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
// Modify createModelError to return TriumvirateError but potentially set modelName in context
export function createModelError(
    message: string,
    category: ErrorCategory,
    modelName: string,
    retryable: boolean,
    originalError?: unknown
): TriumvirateError {
    // Return TriumvirateError
    const context = { modelName }; // Add modelName to context
    const error = new TriumvirateError(
        message,
        category,
        modelName, // Use modelName as component
        retryable,
        originalError,
        context
    );
    error.name = 'ModelError'; // Keep the specific name if needed for identification
    return error;
}

/**
 * Handles common model API errors and provides consistent error messages
 * @param error The error object from the API call
 * @param modelName The name of the model (openai, claude, gemini)
 * @param maxRetries The maximum number of retries attempted
 * @returns A standardized ModelError with appropriate category
 */
// Modify handleModelError to return TriumvirateError
export function handleModelError(
    error: unknown,
    modelName: string,
    maxRetries: number
): TriumvirateError {
    // Return TriumvirateError
    // Log the original error for debugging
    console.debug(`Original ${modelName} error:`, error);

    // Extract error message safely
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Create context for error tracking
    const context = {
        modelName,
        maxRetries,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        originalErrorMessage: errorMessage, // Include original message in context
    };

    // Type guards for common error types
    const isHttpError = (err: unknown): err is { status?: number; message?: string } => {
        return typeof err === 'object' && err !== null && ('status' in err || 'message' in err);
    };

    const isNetworkError = (err: unknown): err is { code?: string; message?: string } => {
        return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
    };

    // If already a TriumvirateError, add context and return it
    if (error instanceof TriumvirateError) {
        error.context = { ...error.context, ...context }; // Merge context
        return error;
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
        (isHttpError(error) && (error as HttpError).status === 401) || // Use HttpError type guard
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
        (isHttpError(error) && (error as HttpError).status === 429) ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('overloaded') || // Added Claude overload
        errorMessage.includes('overloaded_error') // Added Claude overload
    ) {
        return createModelError(
            `${modelName} API rate limit exceeded or service overloaded. Please try again later.`,
            ErrorCategory.RATE_LIMIT,
            modelName,
            true, // retryable
            error
        );
    }

    // Handle input too large errors
    if (
        isHttpError(error) &&
        (error as HttpError).status === 400 &&
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
            ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(
                (error as NetworkError).code || ''
            )) ||
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

    // Handle invalid response errors (e.g., JSON parsing errors)
    if (
        errorMessage.includes('invalid response') ||
        errorMessage.includes('unexpected response') ||
        errorMessage.includes('parsing') ||
        errorMessage.includes('Failed to parse') // Catch specific parsing errors
    ) {
        return createModelError(
            `Received invalid response from ${modelName} API.`,
            ErrorCategory.INVALID_RESPONSE,
            modelName,
            false, // Parsing errors are generally not retryable
            error
        );
    }

    // Handle other HTTP errors
    if (isHttpError(error) && (error as HttpError).status) {
        const status = (error as HttpError).status;
        return createModelError(
            `${modelName} API request failed with status ${status}: ${errorMessage}`,
            ErrorCategory.UNKNOWN, // Or map specific statuses if needed
            modelName,
            false, // Generally not retryable unless specific status codes indicate otherwise
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
export async function exponentialBackoff(
    retryCount: number,
    baseDelayMs: number = 1000, // Base delay
    maxDelayMs: number = 60000 // Max delay to prevent excessively long waits
): Promise<void> {
    const backoffMs = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, retryCount) + Math.random() * 1000
    ); // Add jitter
    console.log(`Backing off for ${backoffMs.toFixed(0)}ms before retry ${retryCount + 1}`);

    return new Promise<void>(resolve => {
        setTimeout(resolve, backoffMs);
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
    component: string, // component can represent the model name or a specific API operation
    maxRetries = 3,
    timeoutMs = 60000
): Promise<T> {
    let retryCount = 0;
    let lastError: TriumvirateError | null = null;

    while (retryCount <= maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(new Error('Operation timed out')),
            timeoutMs
        );

        try {
            if (retryCount > 0) {
                console.log(
                    `Attempt ${retryCount + 1}/${maxRetries + 1} for ${component} API call`
                );
            }
            const result = await apiCall(controller.signal);
            clearTimeout(timeoutId); // Clear timeout on success
            if (retryCount > 0) {
                console.log(`${component} API call succeeded after ${retryCount} retries`);
            }
            return result;
        } catch (error) {
            clearTimeout(timeoutId); // Clear timeout on error as well

            // Categorize error using handleModelError (which now returns TriumvirateError)
            // Pass the component name directly, as handleModelError expects it
            lastError = handleModelError(error, component, maxRetries);

            // Log the error using the error's own logger method
            lastError.logError(); // Use the standardized logger method

            const shouldRetry = lastError.retryable && retryCount < maxRetries;

            if (shouldRetry) {
                console.log(
                    `${component} API call failed (Attempt ${retryCount + 1}/${maxRetries + 1}): ${lastError.message}. Retrying...`
                );
                // Adjust backoff based on category
                const baseDelay = lastError.category === ErrorCategory.RATE_LIMIT ? 5000 : 1000;
                await exponentialBackoff(retryCount, baseDelay);
                retryCount++;
            } else {
                console.error(
                    `${component} API call failed permanently after ${retryCount + 1} attempt(s): ${lastError.message}`
                );
                throw lastError; // Throw the categorized error
            }
        }
        // No finally block needed for clearTimeout as it's handled in both try and catch
    }

    // This part should theoretically be unreachable if logic is correct,
    // but throw the last known error if the loop finishes unexpectedly.
    if (lastError) {
        console.error(`Exhausted retries for ${component}. Last error: ${lastError.message}`);
        throw lastError;
    } else {
        // Should not happen if an error occurred, but needed for type safety
        throw new TriumvirateError(
            'Maximum retries exceeded with no successful result and no specific error recorded',
            ErrorCategory.UNKNOWN,
            component,
            false
        );
    }
}

// --- Functions moved from error-handling-extensions.ts ---

/**
 * Safely execute an async function that might throw an error
 * @param fn The async function to execute
 * @param component The component name for context
 * @param defaultValue The default value to return if the function throws
 * @param logLevel Optional log level for errors (default: 'error')
 * @returns Promise resolving to the result of the function or the default value
 */
export async function safeExecuteAsync<T, D>(
    fn: () => Promise<T>,
    component: string,
    defaultValue: D,
    logLevel: 'error' | 'warn' | 'info' = 'error'
): Promise<T | D> {
    try {
        return await fn();
    } catch (error) {
        const triumvirateError =
            error instanceof TriumvirateError
                ? error
                : new TriumvirateError(
                      error instanceof Error ? error.message : String(error),
                      ErrorCategory.UNKNOWN,
                      component,
                      false,
                      error
                  );

        // Use the error's log method or a default logger
        const loggerMethod = console[logLevel] || console.error;
        loggerMethod(`${component} error in safeExecuteAsync: ${triumvirateError.message}`);
        if (
            logLevel === 'error' &&
            triumvirateError.originalError instanceof Error &&
            triumvirateError.originalError.stack
        ) {
            console.debug('Original stack trace:', triumvirateError.originalError.stack);
        }

        return defaultValue;
    }
}

/**
 * Handle file operation errors with consistent error messages
 * @param error The caught error
 * @param operation The file operation being performed (e.g., 'read', 'write', 'delete')
 * @param filePath The path of the file being operated on
 * @returns A TriumvirateError with appropriate category
 */
export function handleFileError(
    error: unknown,
    operation: string,
    filePath: string
): TriumvirateError {
    // If already a TriumvirateError, return it
    if (error instanceof TriumvirateError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const context = {
        operation,
        filePath,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // Check for common file operation errors
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return new TriumvirateError(
            `File not found during ${operation}: ${filePath}`, // Adjusted message
            ErrorCategory.FILE_SYSTEM,
            'FileSystem',
            false,
            error,
            context
        );
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
        return new TriumvirateError(
            `Permission denied for file operation: ${operation} on ${filePath}`,
            ErrorCategory.FILE_SYSTEM,
            'FileSystem',
            false,
            error,
            context
        );
    }

    if (errorMessage.includes('EEXIST') || errorMessage.includes('already exists')) {
        return new TriumvirateError(
            `File already exists during ${operation}: ${filePath}`, // Adjusted message
            ErrorCategory.FILE_SYSTEM,
            'FileSystem',
            false,
            error,
            context
        );
    }

    // Default error
    return new TriumvirateError(
        `Error during file ${operation} operation on ${filePath}: ${errorMessage}`,
        ErrorCategory.FILE_SYSTEM, // Use FILE_SYSTEM category
        'FileSystem',
        false,
        error,
        context
    );
}

/**
 * Safely execute a file operation that might throw an error
 * @param fn The function to execute
 * @param operation The file operation being performed (e.g., 'read', 'write', 'delete')
 * @param filePath The path of the file being operated on
 * @param defaultValue The default value to return if the function throws
 * @returns The result of the function or the default value
 */
export function safeFileOperation<T, D>(
    fn: () => T,
    operation: string,
    filePath: string,
    defaultValue: D
): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError = handleFileError(error, operation, filePath);
        triumvirateError.logError(); // Use the error's logging method
        return defaultValue;
    }
}

/**
 * Safely execute an async file operation that might throw an error
 * @param fn The async function to execute
 * @param operation The file operation being performed (e.g., 'read', 'write', 'delete')
 * @param filePath The path of the file being operated on
 * @param defaultValue The default value to return if the function throws
 * @returns Promise resolving to the result of the function or the default value
 */
export async function safeFileOperationAsync<T, D>(
    fn: () => Promise<T>,
    operation: string,
    filePath: string,
    defaultValue: D
): Promise<T | D> {
    try {
        return await fn();
    } catch (error) {
        const triumvirateError = handleFileError(error, operation, filePath);
        triumvirateError.logError();
        return defaultValue;
    }
}

/**
 * Handle data processing errors with consistent error messages
 * @param error The caught error
 * @param dataType The type of data being processed
 * @param operation The operation being performed on the data
 * @returns A TriumvirateError with appropriate category
 */
export function handleDataProcessingError(
    error: unknown,
    dataType: string,
    operation: string
): TriumvirateError {
    // If already a TriumvirateError, return it
    if (error instanceof TriumvirateError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const context = {
        dataType,
        operation,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // Check for common data processing errors
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        return new TriumvirateError(
            `Error parsing ${dataType} data during ${operation}: ${errorMessage}`, // Adjusted message
            ErrorCategory.DATA_PROCESSING, // Use specific category
            'DataProcessing',
            false,
            error,
            context
        );
    }

    if (
        errorMessage.includes('undefined') ||
        errorMessage.includes('null') ||
        errorMessage.includes('cannot read properties')
    ) {
        return new TriumvirateError(
            `Missing or invalid data during ${operation} of ${dataType}: ${errorMessage}`,
            ErrorCategory.DATA_PROCESSING, // Use specific category
            'DataProcessing',
            false,
            error,
            context
        );
    }

    // Default error
    return new TriumvirateError(
        `Error during ${operation} of ${dataType} data: ${errorMessage}`,
        ErrorCategory.DATA_PROCESSING, // Use specific category
        'DataProcessing',
        false,
        error,
        context
    );
}

/**
 * Safely execute a data processing function that might throw an error
 * @param fn The function to execute
 * @param dataType The type of data being processed
 * @param operation The operation being performed on the data
 * @param defaultValue The default value to return if the function throws
 * @param logLevel Optional log level for errors (default: 'error')
 * @returns The result of the function or the default value
 */
export function safeDataProcessing<T, D>(
    fn: () => T,
    dataType: string,
    operation: string,
    defaultValue: D,
    logLevel: 'error' | 'warn' | 'info' = 'error'
): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError = handleDataProcessingError(error, dataType, operation);
        // Use the error's log method or a default logger based on logLevel
        const loggerMethod = console[logLevel] || console.error;
        loggerMethod(`Data processing error: ${triumvirateError.message}`);
        if (
            logLevel === 'error' &&
            triumvirateError.originalError instanceof Error &&
            triumvirateError.originalError.stack
        ) {
            console.debug('Original stack trace:', triumvirateError.originalError.stack);
        }
        return defaultValue;
    }
}

/**
 * Handle report generation errors with consistent error messages
 * @param error The caught error
 * @param reportType The type of report being generated
 * @param stage The stage of report generation where the error occurred
 * @returns A TriumvirateError with appropriate category
 */
export function handleReportError(
    error: unknown,
    reportType: string,
    stage: string
): TriumvirateError {
    // If already a TriumvirateError, return it
    if (error instanceof TriumvirateError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const context = {
        reportType,
        stage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
    };

    // Default error
    return new TriumvirateError(
        `Error during ${stage} of ${reportType} report: ${errorMessage}`,
        ErrorCategory.REPORT_GENERATION, // Use specific category
        'ReportGeneration',
        false,
        error,
        context
    );
}

/**
 * Safely execute a report generation function that might throw an error
 * @param fn The function to execute
 * @param reportType The type of report being generated
 * @param stage The stage of report generation where the error occurred
 * @param defaultValue The default value to return if the function throws
 * @param logErrorStack Whether to log the error stack trace (default: true)
 * @returns The result of the function or the default value
 */
export function safeReportGeneration<T, D>(
    fn: () => T,
    reportType: string,
    stage: string,
    defaultValue: D,
    logErrorStack: boolean = true // Keep optional stack logging
): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError = handleReportError(error, reportType, stage);
        console.error(`Report generation error: ${triumvirateError.message}`);

        if (
            logErrorStack &&
            triumvirateError.originalError instanceof Error &&
            triumvirateError.originalError.stack
        ) {
            console.error('Stack trace:', triumvirateError.originalError.stack);
        }

        return defaultValue;
    }
}

/**
 * Safely execute an async report generation function that might throw an error
 * @param fn The async function to execute
 * @param reportType The type of report being generated
 * @param stage The stage of report generation where the error occurred
 * @param defaultValue The default value to return if the function throws
 * @param logErrorStack Whether to log the error stack trace (default: true)
 * @returns Promise resolving to the result of the function or the default value
 */
export async function safeReportGenerationAsync<T, D>(
    fn: () => Promise<T>,
    reportType: string,
    stage: string,
    defaultValue: D,
    logErrorStack: boolean = true // Keep optional stack logging
): Promise<T | D> {
    try {
        return await fn();
    } catch (error) {
        const triumvirateError = handleReportError(error, reportType, stage);
        console.error(`Report generation error: ${triumvirateError.message}`);

        if (
            logErrorStack &&
            triumvirateError.originalError instanceof Error &&
            triumvirateError.originalError.stack
        ) {
            console.error('Stack trace:', triumvirateError.originalError.stack);
        }

        return defaultValue;
    }
}

/**
 * Safely execute a function that might throw an error (Synchronous version)
 * @param fn The function to execute
 * @param component The component name for context
 * @param defaultValue The default value to return if the function throws
 * @param logLevel Optional log level for errors (default: 'error')
 * @returns The result of the function or the default value
 */
// Keep safeExecute for synchronous operations if needed
export function safeExecute<T, D>(
    fn: () => T,
    component: string,
    defaultValue: D,
    logLevel: 'error' | 'warn' | 'info' = 'error'
): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError =
            error instanceof TriumvirateError
                ? error
                : new TriumvirateError(
                      error instanceof Error ? error.message : String(error),
                      ErrorCategory.UNKNOWN,
                      component,
                      false,
                      error
                  );

        // Use the error's log method or a default logger
        const loggerMethod = console[logLevel] || console.error;
        loggerMethod(`${component} error in safeExecute: ${triumvirateError.message}`);
        if (
            logLevel === 'error' &&
            triumvirateError.originalError instanceof Error &&
            triumvirateError.originalError.stack
        ) {
            console.debug('Original stack trace:', triumvirateError.originalError.stack);
        }
        return defaultValue;
    }
}
