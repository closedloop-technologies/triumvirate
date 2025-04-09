/**
 * Types for model responses and related structures
 */

// import type { ReviewCategory, CodeReviewReport } from './report';

/**
 * Base model result structure that represents the common fields
 * returned by different model APIs
 */
export interface ModelResult {
    model: string;
    review: ModelReview;
    summary?: string;
    metrics: {
        latency?: number | string;
        tokenInput?: number;
        tokenOutput?: number;
        tokenTotal?: number;
        cost?: string;
        error?: string;
        [key: string]: unknown;
    };
}

/**
 * Model review structure that can be either a string or a structured review
 */
export type ModelReview = string | StructuredReview;

/**
 * Structured review format with text and potentially other fields
 */
export interface StructuredReview {
    text: string;
    [key: string]: unknown;
}

/**
 * Response from Claude's structured output API
 */
export interface ClaudeStructuredResponse<T> {
    data: T;
    usage: ClaudeUsage;
}

/**
 * Claude API usage information
 */
export interface ClaudeUsage {
    input_tokens: number;
    output_tokens: number;
}

/**
 * Category extraction response from Claude
 */
export interface CategoryExtractionResponse {
    categories: CategoryItem[];
}

/**
 * Individual category item in Claude's response
 */
export interface CategoryItem {
    name: string;
    description: string;
}

/**
 * Findings extraction response from Claude
 */
export interface FindingsExtractionResponse {
    findings: FindingItem[];
}

/**
 * Individual finding item in Claude's response
 * FIXED VERSION - Correctly defines the model agreement structure
 */
export interface FindingItem {
    title: string;
    description: string;
    category: string;
    isStrength: boolean;
    recommendation?: string;
    codeExample?: {
        code: string;
        language: string;
    };
    modelAgreement: Record<string, boolean>; // Maps model ID to boolean agreement status
}

/**
 * Error context for model API calls
 */
export interface ErrorContext {
    timestamp: string;
    requestId?: string;
    endpoint?: string;
    parameters?: Record<string, unknown>;
}
