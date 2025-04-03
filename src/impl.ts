import type { LocalContext } from './context';
import { runTriumvirateReview } from './index';

interface ReviewCommandFlags {
  readonly models?: string[];
  readonly exclude?: string[];
  readonly diff?: boolean;
  readonly output?: string;
  readonly failOnError?: boolean;
  readonly summaryOnly?: boolean;
}

export default async function (this: LocalContext, flags: ReviewCommandFlags): Promise<void> {
  const results = await runTriumvirateReview({
    models: flags.models || ['openai'],
    exclude: flags.exclude || [],
    diffOnly: flags.diff || false,
    outputPath: flags.output,
    failOnError: flags.failOnError || false,
    summaryOnly: flags.summaryOnly || false,
  });

  console.log('Review Results:', results);
}
