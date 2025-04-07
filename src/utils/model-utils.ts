/**
 * Shared utility functions for model error handling
 * Re-exports consolidated error handling functions from error-handling.ts
 */

// Re-export error handling utilities from the central error-handling module
import type { ModelError } from './error-handling';
import { ErrorCategory } from './error-handling';
import {
    createModelError,
    handleModelError,
    exponentialBackoff,
    withErrorHandlingAndRetry,
    safeExecute,
} from './error-handling';

// Re-export everything for backward compatibility
export { ErrorCategory };
export type { ModelError };
export {
    createModelError,
    handleModelError,
    exponentialBackoff,
    withErrorHandlingAndRetry,
    safeExecute,
};
