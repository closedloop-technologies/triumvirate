import fs from 'fs';

import { runModelReview } from './models.js';
import { runRepomix } from './repomix.js';

export async function runTriumvirateReview({
  models,
  exclude,
  diffOnly,
  outputPath,
  failOnError,
  summaryOnly,
  tokenLimit,
}) {
  console.log('Packaging codebase with repomix...');

  // Step 2: Call repomix to package the codebase
  const repomixResult = await runRepomix({
    exclude,
    diffOnly,
    tokenLimit,
  });

  console.log(`Codebase packaged with ${repomixResult.tokenCount} tokens`);

  // Read the packaged codebase
  const codebase = fs.readFileSync(repomixResult.filePath, 'utf8');

  // Step 4: Generate prompt and send to LLMs
  const prompt = `
Please review the following codebase for bugs, design issues, and improvements.

The code is packaged using repomix, which creates a standardized format:

- The "file_summary" section contains information about the repo
- The "directory_structure" section shows the file organization
- The "files" section contains the actual code in each file

${codebase}

Please provide a thorough review that covers:
1. Overall architecture and design patterns
2. Potential bugs or error-prone code
3. Performance considerations
4. Security concerns
5. Specific code improvement recommendations
`;

  console.log('Sending prompt to models...');

  // Step 5: Send to each model and collect responses
  const results = [];
  const startTime = Date.now();

  for (const model of models) {
    console.log(`Running review with model: ${model}`);
    const modelStartTime = Date.now();

    try {
      const review = await runModelReview(prompt, model);
      const modelEndTime = Date.now();
      const latency = modelEndTime - modelStartTime;

      // Estimate cost (this would need actual implementation based on model and token count)
      const cost = estimateCost(model, repomixResult.tokenCount, review.length);

      results.push({
        model,
        review: summaryOnly ? summarizeReview(review) : review,
        metrics: {
          latency: `${latency}ms`,
          cost: `$${cost.toFixed(4)}`,
          tokenCount: repomixResult.tokenCount,
        },
      });
    } catch (error) {
      console.error(`Error with model ${model}:`, error);
      results.push({
        model,
        review: `ERROR: ${error.message}`,
        metrics: {
          latency: 'N/A',
          cost: 'N/A',
          error: error.message,
        },
      });

      if (failOnError) {
        throw error;
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`Review completed in ${totalTime}ms`);

  // Step 6: Write results to output file if specified
  if (outputPath) {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          results,
          summary: {
            totalTime: `${totalTime}ms`,
            totalModels: models.length,
            completedSuccessfully: results.every(r => !r.review.startsWith('ERROR')),
          },
        },
        null,
        2
      )
    );
    console.log(`Results written to ${outputPath}`);
  }

  // Clean up temporary file
  try {
    fs.unlinkSync(repomixResult.filePath);
  } catch (error) {
    console.warn('Could not delete temporary file:', error);
  }

  return results;
}

function summarizeReview(review) {
  // Extract first few sentences for a summary
  const sentences = review.split(/\.\s+/);
  return sentences.slice(0, 3).join('. ') + '.';
}

function estimateCost(model, inputTokens, outputLength) {
  // Rough estimate of output tokens
  const outputTokens = outputLength / 4;

  let inputCostPer1k = 0;
  let outputCostPer1k = 0;

  // Set rates based on model
  if (model === 'openai' || model === 'gpt-4') {
    inputCostPer1k = 0.03;
    outputCostPer1k = 0.06;
  } else if (model === 'claude') {
    inputCostPer1k = 0.015;
    outputCostPer1k = 0.075;
  } else if (model === 'gemini') {
    inputCostPer1k = 0.0035;
    outputCostPer1k = 0.0035;
  }

  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;

  return inputCost + outputCost;
}
