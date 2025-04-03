import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { runModelReview } from './models.js';

export async function runTriumvirateReview({
  models,
  exclude,
  diffOnly,
  outputPath,
  failOnError,
  summaryOnly,
}) {
  const files = getFilesToReview({ exclude, diffOnly });
  const fullCode = files.map(file => fs.readFileSync(file, 'utf8')).join('\n\n');
  const results = [];

  for (const model of models) {
    const review = await runModelReview(fullCode, model);
    results.push({ model, review });
  }

  const summary = summaryOnly ? summarizeResults(results) : results;
  if (outputPath) fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  if (failOnError && results.some(r => r.review.toLowerCase().includes('error'))) {
    process.exit(1);
  }

  return summary;
}

function getFilesToReview({ exclude = [], diffOnly = false }) {
  let files = [];
  if (diffOnly) {
    const diff = execSync('git diff --name-only HEAD~1').toString();
    files = diff.split('\n').filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  } else {
    const walk = dir =>
      fs.readdirSync(dir).flatMap(file => {
        const fullPath = path.join(dir, file);
        return fs.statSync(fullPath).isDirectory() ? walk(fullPath) : fullPath;
      });
    files = walk(process.cwd()).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  }
  return files.filter(f => !exclude.some(e => f.includes(e)));
}

function summarizeResults(results) {
  return results.map(({ model, review }) => ({
    model,
    summary: review.split('\n').slice(0, 3).join(' '),
  }));
}
