export interface TriumvirateReviewOptions {
  models: string[];
  exclude: string[];
  diffOnly: boolean;
  outputPath?: string;
  failOnError: boolean;
  summaryOnly: boolean;
  tokenLimit?: number;
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
}

export interface RepomixResult {
  filePath: string;
  tokenCount: number;
  directoryStructure: string;
  summary: string;
}

export function runRepomix(options: RepomixOptions): Promise<RepomixResult>;
