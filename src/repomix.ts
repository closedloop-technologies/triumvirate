import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DEFAULT_REPOMIX_OPTIONS, DEFAULT_REVIEW_OPTIONS } from './utils/constants';

export interface RepomixResult {
    filePath: string;
    tokenCount: number;
    directoryStructure: string;
    summary: string;
    stdout: string;
    stderr: string;
}

/**
 * Options for running repomix
 */
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

/**
 * Run repomix with the specified options
 * @param options - Options for running repomix
 * @returns Result of running repomix
 */
export async function runRepomix({
    exclude = DEFAULT_REVIEW_OPTIONS.EXCLUDE,
    diffOnly = DEFAULT_REVIEW_OPTIONS.DIFF_ONLY,
    tokenLimit = DEFAULT_REVIEW_OPTIONS.TOKEN_LIMIT,
    include,
    ignorePatterns,
    style = DEFAULT_REPOMIX_OPTIONS.STYLE,
    compress = DEFAULT_REPOMIX_OPTIONS.COMPRESS,
    removeComments = DEFAULT_REPOMIX_OPTIONS.REMOVE_COMMENTS,
    removeEmptyLines = DEFAULT_REPOMIX_OPTIONS.REMOVE_EMPTY_LINES,
    showLineNumbers = DEFAULT_REPOMIX_OPTIONS.SHOW_LINE_NUMBERS,
    headerText,
    instructionFilePath,
    topFilesLen = DEFAULT_REPOMIX_OPTIONS.TOP_FILES_LEN,
    tokenCountEncoding = DEFAULT_REPOMIX_OPTIONS.TOKEN_COUNT_ENCODING,
}: RepomixOptions): Promise<RepomixResult> {
    // Create a temporary directory for Repomix output
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'triumvirate-'));
    const tempFilePath = path.join(tempDir, `repomix-output.${style}`);

    // Build repomix command
    const repomixArgs = [
        'repomix',
        `-o ${tempFilePath}`,
        `--style=${style}`,
        `--top-files-len=${topFilesLen}`,
        `--token-count-encoding=${tokenCountEncoding}`,
    ];

    // Add optional flags
    // sourcery skip: use-braces
    if (compress) repomixArgs.push('--compress');
    if (removeComments) repomixArgs.push('--remove-comments');
    if (removeEmptyLines) repomixArgs.push('--remove-empty-lines');
    if (showLineNumbers) repomixArgs.push('--output-show-line-numbers');
    if (headerText) repomixArgs.push(`--header-text=${headerText}`);
    if (instructionFilePath) repomixArgs.push(`--instruction-file-path=${instructionFilePath}`);

    // Handle include patterns
    if (include && include.length > 0) {
        repomixArgs.push(`--include=${include.join(',')}`);
    }

    // Handle ignore patterns
    if (exclude && exclude.length > 0) {
        repomixArgs.push(`-i=${exclude.join(',')}`);
    }

    if (ignorePatterns && ignorePatterns.length > 0) {
        repomixArgs.push(`-i=${ignorePatterns.join(',')}`);
    }

    // Handle diff-only mode
    if (diffOnly) {
        try {
            // Get list of changed files from git
            const changedFiles = execSync('git diff --name-only HEAD')
                .toString()
                .trim()
                .split('\n')
                .filter(Boolean);

            if (changedFiles.length > 0) {
                repomixArgs.push(`--include=${changedFiles.join(',')}`);
            }
        } catch (error) {
            console.warn('Git diff failed, falling back to processing all files');
        }
    }

    console.log(`Running Repomix: npx ${repomixArgs.join(' ')}`);

    // Execute repomix using spawn to capture stdout/stderr
    const repomixProcess = spawn('npx', repomixArgs, { shell: true });

    let stdout = '';
    let stderr = '';

    repomixProcess.stdout.on('data', data => {
        stdout += data.toString();
        process.stdout.write(data); // Forward to parent process stdout
    });

    repomixProcess.stderr.on('data', data => {
        stderr += data.toString();
        process.stderr.write(data); // Forward to parent process stderr
    });

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
        repomixProcess.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Repomix process exited with code ${code}`));
            }
        });
    });

    // Parse token count from output
    const tokenCountMatch = stdout.match(/Total tokens: ([0-9,]+)/);
    const tokenCount =
        tokenCountMatch && tokenCountMatch[1]
            ? parseInt(tokenCountMatch[1].replace(/,/g, ''), 10)
            : 0;

    // Check if we need to optimize
    if (tokenCount > tokenLimit) {
        console.log(`Token count (${tokenCount}) exceeds limit (${tokenLimit}), optimizing...`);
        return optimizeRepomix({
            exclude,
            diffOnly,
            tokenLimit,
            currentTokens: tokenCount,
            tempFilePath,
            include,
            ignorePatterns,
            style,
            compress,
            removeComments,
            removeEmptyLines,
            showLineNumbers,
            headerText,
            instructionFilePath,
            topFilesLen,
            tokenCountEncoding,
            stdout,
            stderr,
        });
    }

    // Read the generated file to extract summary and structure
    const fileContent = fs.readFileSync(tempFilePath, 'utf8');

    // Extract directory structure
    const directoryStructureMatch = fileContent.match(
        /<directory_structure>([\s\S]*?)<\/directory_structure>/
    );
    const directoryStructure =
        directoryStructureMatch && directoryStructureMatch[1]
            ? directoryStructureMatch[1].trim()
            : '';

    // Extract file summary
    const summaryMatch = fileContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
    const summary = summaryMatch && summaryMatch[1] ? summaryMatch[1].trim() : '';

    return {
        filePath: tempFilePath,
        tokenCount,
        directoryStructure,
        summary,
        stdout,
        stderr,
    };
}

/**
 * Optimize repomix command if token count exceeds limit
 */
async function optimizeRepomix({
    exclude,
    diffOnly,
    tokenLimit,
    currentTokens,
    tempFilePath,
    include,
    ignorePatterns,
    style,
    compress,
    removeComments,
    removeEmptyLines,
    showLineNumbers,
    headerText,
    instructionFilePath,
    topFilesLen,
    tokenCountEncoding,
    stdout,
    stderr,
}: RepomixOptions & {
    currentTokens: number;
    tempFilePath: string;
    stdout: string;
    stderr: string;
}): Promise<RepomixResult> {
    // Read the original file to extract summary and structure
    const fileContent = fs.readFileSync(tempFilePath, 'utf8');

    // Extract directory structure
    const directoryStructureMatch = fileContent.match(
        /<directory_structure>([\s\S]*?)<\/directory_structure>/
    );
    const directoryStructure =
        directoryStructureMatch && directoryStructureMatch[1]
            ? directoryStructureMatch[1].trim()
            : '';

    // Extract file summary
    const summaryMatch = fileContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
    const summary = summaryMatch && summaryMatch[1] ? summaryMatch[1].trim() : '';

    // Automatic optimization strategy:
    // 1. If compress wasn't used, try with compression
    // 2. Try removing comments
    // 3. Try removing empty lines
    // 4. Try excluding large files based on token count

    const updatedOptions: RepomixOptions = {
        exclude: [...(exclude || [])],
        diffOnly,
        tokenLimit,
        include,
        ignorePatterns,
        style,
        compress: true, // Always enable compression for optimization
        removeComments: true, // Always remove comments for optimization
        removeEmptyLines: true, // Always remove empty lines for optimization
        showLineNumbers,
        headerText,
        instructionFilePath,
        topFilesLen,
        tokenCountEncoding,
    };

    // Extract top files info from stdout
    const topFilesPattern = /(\d+)\.\s+([^\s].*?)\s+(\d+,?\d*)\s+chars/g;
    const topFiles: { path: string; size: number }[] = [];

    let match;
    while ((match = topFilesPattern.exec(stdout)) !== null) {
        topFiles.push({
            path: match && match[2] ? match[2] : '',
            size: match && match[3] ? parseInt(match[3].replace(/,/g, ''), 10) : 0,
        });
    }

    // Add largest files to exclude list
    if (topFiles.length > 0) {
        // Sort by size and take top files that contribute most to token count
        topFiles.sort((a, b) => b.size - a.size);

        // Exclude the largest files until we get under token limit
        // This is a simplistic approach - a more sophisticated approach would consider
        // dependencies between files and importance to the codebase
        let filesExcluded = 0;
        for (const file of topFiles) {
            if (filesExcluded >= 3) break; // Don't exclude too many files at once

            // Skip if file is already excluded
            if (updatedOptions.exclude?.includes(file.path)) continue;

            // Add to exclude list
            updatedOptions.exclude?.push(file.path);
            filesExcluded++;

            console.log(`Excluding large file: ${file.path} (${file.size} chars)`);
        }
    }

    // Re-run repomix with optimized settings
    console.log('Re-running Repomix with optimized settings...');
    return runRepomix(updatedOptions);
}
