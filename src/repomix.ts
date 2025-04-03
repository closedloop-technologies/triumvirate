// src/repomix.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface RepomixResult {
  filePath: string;
  tokenCount: number;
  directoryStructure: string;
  summary: string;
}

export interface RepomixOptions {
  exclude?: string[];
  diffOnly?: boolean;
  tokenLimit?: number;
}

export async function runRepomix({
  exclude = [],
  diffOnly = false,
  tokenLimit = 100000,
}: RepomixOptions): Promise<RepomixResult> {
  // Create temp file path
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `triumvirate-${Date.now()}.txt`);

  // Build repomix command
  let repomixCommand = 'npx repomix@latest';

  if (diffOnly) {
    repomixCommand += ' --diff';
  }

  if (exclude.length > 0) {
    repomixCommand += ` --exclude "${exclude.join(',')}"`;
  }

  repomixCommand += ` --output "${tempFilePath}"`;

  console.log(`Running: ${repomixCommand}`);

  // Execute repomix
  const output = execSync(repomixCommand, { encoding: 'utf8' });

  // Parse token count from output
  const tokenMatch = output.match(/Estimated token count: (\d+)/);
  const tokenCount = tokenMatch && tokenMatch[1] ? parseInt(tokenMatch[1], 10) : 0;

  // Check if we need to optimize
  if (tokenCount > tokenLimit) {
    console.log(
      `Token count ${tokenCount} exceeds limit ${tokenLimit}, optimizing repomix command...`
    );
    return await optimizeRepomix({
      exclude,
      diffOnly,
      tokenLimit,
      currentTokens: tokenCount,
      tempFilePath,
    });
  }

  // Read the generated file to extract summary and structure
  const fileContent = fs.readFileSync(tempFilePath, 'utf8');
  const summaryMatch = fileContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
  const directoryMatch = fileContent.match(
    /<directory_structure>([\s\S]*?)<\/directory_structure>/
  );

  return {
    filePath: tempFilePath,
    tokenCount,
    directoryStructure: directoryMatch && directoryMatch[1] ? directoryMatch[1] : '',
    summary: summaryMatch && summaryMatch[1] ? summaryMatch[1] : '',
  };
}

async function optimizeRepomix({
  exclude,
  diffOnly,
  tokenLimit,
  currentTokens,
  tempFilePath,
}: RepomixOptions & { currentTokens: number; tempFilePath: string }): Promise<RepomixResult> {
  // Read the original file to extract summary and structure
  const fileContent = fs.readFileSync(tempFilePath, 'utf8');
  const summaryMatch = fileContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
  const directoryMatch = fileContent.match(
    /<directory_structure>([\s\S]*?)<\/directory_structure>/
  );

  const summary = summaryMatch && summaryMatch[1] ? summaryMatch[1] : '';
  const directoryStructure = directoryMatch && directoryMatch[1] ? directoryMatch[1] : '';

  // Use an LLM to suggest better exclude patterns
  const { runModelReview } = await import('./models');
  const prompt = `
I'm using repomix to package my codebase for analysis, but it generated ${currentTokens} tokens, which exceeds my limit of ${tokenLimit}.
Here is the directory structure:
${directoryStructure}

Here is the summary of the codebase:
${summary}

Current exclude patterns: ${exclude ? exclude.join(', ') : 'none'}
Is diffOnly mode on? ${diffOnly ? 'Yes' : 'No'}

Please suggest a better repomix command that would help reduce the token count below ${tokenLimit}. 
Focus on excluding test files, documentation, configuration files, and other non-essential code while keeping the core functionality.
Provide the command in the format:
COMMAND: npx repomix@latest [options]
`;

  const suggestion = await runModelReview(prompt, 'openai');
  const commandMatch = suggestion.match(/COMMAND: (npx repomix@latest.+)/);

  if (!commandMatch) {
    console.log('Could not get optimization recommendation. Using original file.');
    return {
      filePath: tempFilePath,
      tokenCount: currentTokens,
      directoryStructure: directoryStructure || '',
      summary: summary || '',
    };
  }

  // Execute the suggested command
  const optimizedCommand = commandMatch[1] + ` --output "${tempFilePath}"`;
  console.log(`Running optimized command: ${optimizedCommand}`);

  try {
    const output = execSync(optimizedCommand, { encoding: 'utf8' });
    const tokenMatch = output.match(/Estimated token count: (\d+)/);
    const newTokenCount = tokenMatch && tokenMatch[1] ? parseInt(tokenMatch[1], 10) : currentTokens;

    // Read the updated file
    const updatedContent = fs.readFileSync(tempFilePath, 'utf8');
    const updatedSummaryMatch = updatedContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
    const updatedDirMatch = updatedContent.match(
      /<directory_structure>([\s\S]*?)<\/directory_structure>/
    );

    return {
      filePath: tempFilePath,
      tokenCount: newTokenCount,
      directoryStructure:
        updatedDirMatch && updatedDirMatch[1] ? updatedDirMatch[1] : directoryStructure || '',
      summary:
        updatedSummaryMatch && updatedSummaryMatch[1] ? updatedSummaryMatch[1] : summary || '',
    };
  } catch (error) {
    console.error('Error running optimized command:', error);
    return {
      filePath: tempFilePath,
      tokenCount: currentTokens,
      directoryStructure: directoryStructure || '',
      summary: summary || '',
    };
  }
}
