/**
 * Extended error handling utilities for Triumvirate
 *
 * This module provides additional error handling utilities that build on the
 * core error handling system in error-handling.ts. It includes specialized
 * utilities for file operations, data processing, and report generation.
 */
import { TriumvirateError, ErrorCategory, handleModelError } from './error-handling';

/**
 * Safely execute an async function that might throw an error
 * @param fn The async function to execute
 * @param component The component name for context
 * @param defaultValue The default value to return if the function throws
 * @param isModelComponent Optional flag to indicate if this is a model component (for model-specific error handling)
 * @param logLevel Optional log level for errors (default: 'error')
 * @returns Promise resolving to the result of the function or the default value
 */
export async function safeExecuteAsync<T, D>(
    fn: () => Promise<T>,
    component: string,
    defaultValue: D,
    isModelComponent: boolean = false,
    logLevel: 'error' | 'warn' | 'info' = 'error'
): Promise<T | D> {
    // Track any resources that need cleanup
    let cleanupFunctions: Array<() => void> = [];

    try {
        // Execute the async function and return its result
        return await fn();
    } catch (error) {
        if (isModelComponent) {
            // Use model-specific error handling
            const modelError = handleModelError(
                error,
                component, // component is the model name in this case
                3 // default max retries
            );
            if (logLevel === 'error') {
                console.error(`Model error in safeExecuteAsync: ${modelError.message}`);
            } else if (logLevel === 'warn') {
                console.warn(`Model error in safeExecuteAsync: ${modelError.message}`);
            } else {
                console.info(`Model error in safeExecuteAsync: ${modelError.message}`);
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
    } finally {
        // Clean up any resources
        for (const cleanup of cleanupFunctions) {
            try {
                cleanup();
            } catch (cleanupError) {
                console.error(`Error during async execution cleanup: ${cleanupError}`);
            }
        }
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
            `File not found: ${filePath}`,
            ErrorCategory.UNKNOWN,
            'FileSystem',
            false,
            error,
            context
        );
    }

    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
        return new TriumvirateError(
            `Permission denied for file operation: ${operation} on ${filePath}`,
            ErrorCategory.UNKNOWN,
            'FileSystem',
            false,
            error,
            context
        );
    }

    if (errorMessage.includes('EEXIST') || errorMessage.includes('already exists')) {
        return new TriumvirateError(
            `File already exists: ${filePath}`,
            ErrorCategory.UNKNOWN,
            'FileSystem',
            false,
            error,
            context
        );
    }

    // Default error
    return new TriumvirateError(
        `Error during file ${operation} operation on ${filePath}: ${errorMessage}`,
        ErrorCategory.UNKNOWN,
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
        triumvirateError.logError();
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
    // Track any resources that need cleanup
    let cleanupFunctions: Array<() => void> = [];

    try {
        // Execute the async function and return its result
        return await fn();
    } catch (error) {
        const triumvirateError = handleFileError(error, operation, filePath);
        triumvirateError.logError();
        return defaultValue;
    } finally {
        // Clean up any resources
        for (const cleanup of cleanupFunctions) {
            try {
                cleanup();
            } catch (cleanupError) {
                console.error(`Error during file operation cleanup: ${cleanupError}`);
            }
        }
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
            `Error parsing ${dataType} data: ${errorMessage}`,
            ErrorCategory.INVALID_RESPONSE,
            'DataProcessing',
            false,
            error,
            context
        );
    }

    if (errorMessage.includes('undefined') || errorMessage.includes('null')) {
        return new TriumvirateError(
            `Missing data during ${operation} of ${dataType}: ${errorMessage}`,
            ErrorCategory.INVALID_RESPONSE,
            'DataProcessing',
            false,
            error,
            context
        );
    }

    // Default error
    return new TriumvirateError(
        `Error during ${operation} of ${dataType} data: ${errorMessage}`,
        ErrorCategory.UNKNOWN,
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

        if (logLevel === 'error') {
            console.error(`Data processing error: ${triumvirateError.message}`);
        } else if (logLevel === 'warn') {
            console.warn(`Data processing error: ${triumvirateError.message}`);
        } else {
            console.info(`Data processing error: ${triumvirateError.message}`);
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
        ErrorCategory.UNKNOWN,
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
    logErrorStack: boolean = true
): T | D {
    try {
        return fn();
    } catch (error) {
        const triumvirateError = handleReportError(error, reportType, stage);
        console.error(`Report generation error: ${triumvirateError.message}`);

        if (logErrorStack && error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
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
    logErrorStack: boolean = true
): Promise<T | D> {
    try {
        // Ensure we're properly awaiting the promise
        return await fn();
    } catch (error) {
        // Handle the error properly
        const triumvirateError = handleReportError(error, reportType, stage);
        console.error(`Report generation error: ${triumvirateError.message}`);

        if (logErrorStack && error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
        }

        // Return the default value when an error occurs
        return defaultValue;
    }
}
