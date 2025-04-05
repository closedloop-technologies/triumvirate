/**
 * Types for error handling and API error responses
 */

import { ErrorCategory } from '../utils/error-handling';

/**
 * Represents an HTTP error with status code
 */
export interface HttpError extends Error {
    status?: number;
    statusCode?: number;
    code?: string;
}

/**
 * Represents a network error with error code
 */
export interface NetworkError extends Error {
    code?: string;
    syscall?: string;
    address?: string;
    port?: number;
}

/**
 * Represents an API error response
 */
export interface ApiErrorResponse {
    error?: {
        message?: string;
        type?: string;
        code?: string;
        param?: string;
    };
    message?: string;
    status?: number;
    statusCode?: number;
}

/**
 * Error context for additional debugging information
 */
export interface ErrorContext {
    timestamp: string;
    component: string;
    requestId?: string;
    endpoint?: string;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
}
