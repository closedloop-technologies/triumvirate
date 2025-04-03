
// src/impl.ts
import type { LocalContext } from './context';
import { runTriumvirateReview } from './index.js';

interface ReviewCommandFlags {
    readonly models?: string[];
    readonly exclude?: string[];
    readonly diff?: boolean;
    readonly output?: string;
    readonly failOnError?: boolean;
    readonly summaryOnly?: boolean;
    readonly tokenLimit?: number;
}

export default async function (this: LocalContext, flags: ReviewCommandFlags): Promise<void> {
    try {
        console.log('Starting Triumvirate Review...');

        const results = await runTriumvirateReview({
            models: flags.models || ['openai'],
            exclude: flags.exclude || [],
            diffOnly: flags.diff || false,
            outputPath: flags.output,
            failOnError: flags.failOnError || false,
            summaryOnly: flags.summaryOnly || false,
            tokenLimit: flags.tokenLimit || 100000,
        });

        console.log('Review Results:', results);

        if (flags.failOnError && results.some(r => r.review.toLowerCase().includes('error'))) {
            console.error('Errors found in model responses. Exiting with code 1.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error during review:', error);
        if (flags.failOnError) {
            process.exit(1);
        }
    }
}
