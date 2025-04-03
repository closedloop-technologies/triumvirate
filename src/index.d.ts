export interface TriumvirateReviewOptions {
    models: string[];
    exclude: string[];
    diffOnly: boolean;
    outputPath?: string;
    failOnError: boolean;
    summaryOnly: boolean;
    tokenLimit?: number;
    reviewType?: string;
    repomixOptions?: RepomixPassthroughOptions;
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

// src/repomix.d.ts
export interface RepomixOptions {
    exclude?: string[];
    diffOnly?: boolean;
    tokenLimit?: number;
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

export interface RepomixResult {
    filePath: string;
    tokenCount: number;
    directoryStructure: string;
    summary: string;
    stdout: string;
    stderr: string;
}

export function runRepomix(options: RepomixOptions): Promise<RepomixResult>;
