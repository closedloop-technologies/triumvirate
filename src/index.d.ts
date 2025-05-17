import type { CliOptions } from './types/report';

export interface TriumvirateReviewOptions {
    models?: string[];
    exclude?: string[];
    diffOnly?: boolean;
    outputPath?: string;
    failOnError?: boolean;
    summaryOnly?: boolean;
    tokenLimit?: number;
    reviewType?: string;
    repomixOptions?: RepomixPassthroughOptions | Record<string, unknown>;
    enhancedReport?: boolean;
    options?: CliOptions;
}

export interface RepomixPassthroughOptions {
    include?: string[];
    ignorePatterns?: string[];
    style?: string;
    compress?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    showLineNumbers?: boolean;
    headerText?: string;
    instructionFilePath?: string;
    topFilesLen?: number;
    tokenCountEncoding?: string;
}

export interface ReviewMetrics {
    latency: string;
    cost: string;
    tokenCount?: number;
    error?: string;
}

export interface ReviewResult {
    model: string;
    review: string;
    metrics: ReviewMetrics;
}

export function runTriumvirateReview(options: TriumvirateReviewOptions): Promise<ReviewResult[]>;
