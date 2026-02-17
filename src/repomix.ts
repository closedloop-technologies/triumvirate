// src/repomix.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import logUpdate from 'log-update';
import pc from 'picocolors';
import { pack } from 'repomix';

import {
    DEFAULT_REPOMIX_OPTIONS,
    DEFAULT_REVIEW_OPTIONS,
    MAX_FILES_TO_EXCLUDE,
} from './utils/constants';

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

// We're not defining a RepomixConfig interface since we're using type assertions
// to bypass TypeScript checking for the pack function call

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
    try {
        // Create a temporary directory for Repomix output
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'triumvirate-'));
        const tempFilePath = path.join(tempDir, `repomix-output.${style}`);

        console.log(`Creating Repomix output at ${tempFilePath}`);

        // Build repomix configuration with all required properties
        const config = {
            output: {
                filePath: tempFilePath,
                style: style as 'xml' | 'markdown' | 'plain',
                compress: compress || false,
                removeComments: removeComments || false,
                removeEmptyLines: removeEmptyLines || false,
                showLineNumbers: showLineNumbers || false,
                headerText: headerText || undefined,
                instructionFilePath: instructionFilePath || undefined,
                topFilesLength: topFilesLen || 20,
                // Add required properties that weren't in our options
                parsableStyle: false,
                fileSummary: true,
                directoryStructure: true,
                includeEmptyDirectories: false,
                copyToClipboard: false,
                git: {
                    enabled: false,
                },
            },
            tokenCount: {
                encoding: tokenCountEncoding as string,
            },
            ignore: {
                useGitignore: true,
                useDefaultPatterns: true,
                customPatterns: [] as string[],
            },
            // Add required properties
            include: [] as string[],
            security: {
                enabled: true,
            },
            // Input options required by repomix 1.11+
            input: {
                maxFileSize: 10 * 1024 * 1024, // 10MB default
            },
        };

        // Handle include patterns
        if (include && include.length > 0) {
            config.include = [...config.include, ...include];
        }

        // Handle ignore patterns
        if (exclude && exclude.length > 0) {
            config.ignore.customPatterns = [...config.ignore.customPatterns, ...exclude];
        }

        if (ignorePatterns && ignorePatterns.length > 0) {
            config.ignore.customPatterns = [...config.ignore.customPatterns, ...ignorePatterns];
        }

        // Handle diff-only mode
        const rootDirs = ['.'];
        if (diffOnly) {
            try {
                // Get list of changed files from git
                const changedFiles = execSync('git diff --name-only HEAD')
                    .toString()
                    .trim()
                    .split('\n')
                    .filter(Boolean);

                if (changedFiles.length > 0) {
                    config.include = [...config.include, ...changedFiles];
                }
            } catch (error) {
                console.warn('Git diff failed, falling back to processing all files:', error);
            }
        }

        // console.debug('Running Repomix with configuration:', JSON.stringify(config, null, 2));

        // Create a simple array to store the last 5 log messages
        const logMessages: string[] = [];
        const maxLogLines = 5;

        // Function to update the log box
        const updateLogBox = async () => {
            if (logMessages.length === 0) {
                return;
            }

            // Create the box with the lines
            const boxWidth = 80;
            const topBorder = `┌${'─'.repeat(boxWidth)}┐`;
            const bottomBorder = `└${'─'.repeat(boxWidth)}┘`;

            const contentLines = logMessages.map(line => {
                // Truncate or pad the line to fit the box width
                const displayLine =
                    line.length > boxWidth - 4
                        ? line.substring(0, boxWidth - 7) + '...'
                        : line.padEnd(boxWidth - 4, ' ');
                return `│ ${pc.gray(displayLine)} │`;
            });

            // Join all lines with newlines
            const content = contentLines.join('\n');

            // Use logUpdate to update the console in place
            logUpdate(`${pc.cyan(topBorder)}\n${content}\n${pc.cyan(bottomBorder)}`);
        };

        // Run repomix programmatically
        // Use unknown type to bypass TypeScript checking
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const packResult = await pack(rootDirs, config as unknown as any, message => {
            // Add message to our log array
            logMessages.push(message.trim());
            // Keep only the last 5 messages
            if (logMessages.length > maxLogLines) {
                logMessages.shift();
            }
            // Update the log box
            updateLogBox();
            // Still write to stdout but don't display it
            // process.stdout.write(message + '\n');
        });

        // Finalize the log display
        logUpdate.done();

        // Check if we need to optimize
        if (packResult.totalTokens > tokenLimit) {
            console.log(
                `Token count (${packResult.totalTokens}) exceeds limit (${tokenLimit}), optimizing...`
            );
            return optimizeRepomix({
                exclude,
                diffOnly,
                tokenLimit,
                include,
                ignorePatterns,
                style,
                fileCharCounts: packResult.fileCharCounts,
                showLineNumbers,
                headerText,
                instructionFilePath,
                topFilesLen,
                tokenCountEncoding,
            });
        }

        // Read the generated file to extract summary and structure
        const fileContent = fs.readFileSync(tempFilePath, 'utf8');

        // Extract directory structure
        let directoryStructure = '';
        const directoryStructureMatch = fileContent.match(
            /<directory_structure>([\s\S]*?)<\/directory_structure>/
        );
        if (directoryStructureMatch && directoryStructureMatch[1]) {
            directoryStructure = directoryStructureMatch[1].trim();
        } else {
            console.warn('Could not extract directory structure from output file');
        }

        // Extract file summary
        let summary = '';
        const summaryMatch = fileContent.match(/<file_summary>([\s\S]*?)<\/file_summary>/);
        if (summaryMatch && summaryMatch[1]) {
            summary = summaryMatch[1].trim();
        } else {
            console.warn('Could not extract summary from output file');
        }

        return {
            filePath: tempFilePath,
            tokenCount: packResult.totalTokens,
            directoryStructure,
            summary,
            stdout: `Total Tokens: ${packResult.totalTokens}`, // Maintain backward compatibility
            stderr: '',
        };
    } catch (error) {
        console.error('Error running repomix:', error);
        throw new Error(
            `Failed to run repomix: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Optimize repomix command if token count exceeds limit
 */
async function optimizeRepomix({
    exclude,
    diffOnly,
    tokenLimit,
    include,
    ignorePatterns,
    style,
    fileCharCounts,
    showLineNumbers,
    headerText,
    instructionFilePath,
    topFilesLen,
    tokenCountEncoding,
}: RepomixOptions & {
    fileCharCounts: Record<string, number>;
}): Promise<RepomixResult> {
    // Automatic optimization strategy:
    // 1. Always enable compression, comment removal, and empty line removal
    // 2. Exclude large files based on character count if needed

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

    // If we have file character counts, use them to exclude large files
    if (fileCharCounts && Object.keys(fileCharCounts).length > 0) {
        // Create array of files with their sizes
        const topFiles = Object.entries(fileCharCounts).map(([path, size]) => ({
            path,
            size,
        }));

        // Sort by size (largest first)
        topFiles.sort((a, b) => b.size - a.size);

        // Exclude the largest files until we get under token limit
        let filesExcluded = 0;
        for (const file of topFiles) {
            if (filesExcluded >= MAX_FILES_TO_EXCLUDE) {
                break; // Don't exclude too many files at once
            }

            // Skip if file is already excluded
            if (updatedOptions.exclude?.includes(file.path)) {
                continue;
            }

            // Add to exclude list
            updatedOptions.exclude?.push(file.path);
            filesExcluded++;

            console.log(`Excluding large file: ${file.path} (${file.size} chars)`);
        }
    } else {
        console.warn('No file character counts available for optimization');
    }

    // Re-run repomix with optimized settings
    console.log('Re-running Repomix with optimized settings...');
    return runRepomix(updatedOptions);
}
