import { runTriumvirateReview } from '../src/index.js';

(async () => {
  const results = await runTriumvirateReview({
    models: ['openai', 'claude', 'gemini'],
    exclude: ['node_modules', '.git'],
    diffOnly: false,
    outputPath: 'triumvirate.json',
    failOnError: false,
    summaryOnly: true,
  });
  console.log(JSON.stringify(results, null, 2));
})();
