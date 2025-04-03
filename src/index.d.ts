export interface TriumvirateReviewOptions {
  models: string[];
  exclude: string[];
  diffOnly: boolean;
  outputPath?: string;
  failOnError: boolean;
  summaryOnly: boolean;
}

export interface ReviewResult {
  model: string;
  review: string;
}

export function runTriumvirateReview(options: TriumvirateReviewOptions): Promise<ReviewResult[]>;
