import * as fs from 'fs';
import * as path from 'path';

import { generatePlanWithBAML, useBAML } from '../../utils/baml-providers.js';
import {
    safeFileOperationAsync,
    safeReportGenerationAsync,
} from '../../utils/error-handling-extensions.js';
import { TriumvirateError, ErrorCategory } from '../../utils/error-handling.js';
import type { LLMProvider } from '../../utils/llm-providers.js';
import { ClaudeProvider, OpenAIProvider, GeminiProvider } from '../../utils/llm-providers.js';
import { logger } from '../../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface PlanOptions {
    input?: string;
    output?: string;
    agentModel?: string; // DoD: Add agent model option
    task?: string; // DoD: Add task description option
    verbose?: boolean;
    quiet?: boolean;
}

// DoD: Align Task structure with TASKS.md requirements
interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    type?: 'bug' | 'enhancement' | 'debt' | 'docs' | 'refactor'; // Optional type
    completed: boolean;
    // Future fields from TASKS.md: affected_components, acceptance_criteria, effort, git_prefix
}

interface Plan {
    tasks: Task[];
    metadata: {
        createdAt: string;
        sourceFile: string;
    };
}

// DoD: Define schema for the structured LLM response
const planSchema = {
    type: 'object',
    properties: {
        tasks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier for the task (e.g., task-1)',
                    },
                    title: { type: 'string', description: 'Concise title for the task' },
                    description: {
                        type: 'string',
                        description: 'Detailed description of the task',
                    },
                    priority: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'Priority of the task',
                    },
                    dependencies: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of task IDs this task depends on',
                    },
                    type: {
                        type: 'string',
                        enum: ['bug', 'enhancement', 'debt', 'docs', 'refactor'],
                        description: 'Type of task',
                    },
                },
                required: ['id', 'title', 'description', 'priority', 'dependencies'],
            },
            description: 'List of tasks extracted from the code review summary',
        },
    },
    required: ['tasks'],
};

export const runPlanAction = async (options: PlanOptions): Promise<void> => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.debug('options:', options);

    let { input } = options; // DoD: Use agentModel and task options
    const { output, agentModel = 'claude', task } = options; // DoD: Use agentModel and task options

    if (!input) {
        // Try to find the latest summary file from tri review in the default output directory
        const defaultOutputDir = './.triumvirate';
        try {
            const outputDirPath = path.isAbsolute(defaultOutputDir)
                ? defaultOutputDir
                : path.resolve(process.cwd(), defaultOutputDir);
            const files = await safeFileOperationAsync(
                async () => fs.promises.readdir(outputDirPath),
                'read',
                outputDirPath,
                []
            );

            // Filter for summary files (markdown files with tri-review prefix)
            const summaryFiles = files.filter(
                file => file.startsWith('tri-review-') && file.endsWith('.md')
            );

            if (summaryFiles.length > 0) {
                // Sort by modification time (most recent first)
                const sortedFiles = await Promise.all(
                    summaryFiles.map(async file => {
                        const filePath = path.join(outputDirPath, file);
                        const stats = await fs.promises.stat(filePath);
                        return { file, mtime: stats.mtime };
                    })
                );
                sortedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

                // Use the most recent file
                if (sortedFiles.length > 0 && sortedFiles[0]) {
                    input = path.join(defaultOutputDir, sortedFiles[0].file);
                    logger.info(`Using latest review summary: ${input}`);
                } else {
                    logger.error(
                        'No valid review summary files found in the default output directory.'
                    );
                    logger.error(
                        'Please run "tri review" first or specify an input file with --input.'
                    );
                    process.exit(1);
                }
            } else {
                logger.error('No review summary files found in the default output directory.');
                logger.error(
                    'Please run "tri review" first or specify an input file with --input.'
                );
                process.exit(1);
            }
        } catch {
            logger.error('Error finding latest review summary file.');
            logger.error('Please run "tri review" first or specify an input file with --input.');
            process.exit(1);
        }
    }

    // Create a spinner for progress reporting
    const spinner = new Spinner('Generating task plan from summary...', {
        quiet: options.quiet,
        verbose: options.verbose,
    });
    spinner.start();

    try {
        const summaryPath = path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
        spinner.update(`Reading summary file: ${summaryPath}`);
        const summaryContent = await safeFileOperationAsync(
            async () => fs.promises.readFile(summaryPath, 'utf8'),
            'read',
            summaryPath,
            null
        );

        if (summaryContent === null) {
            spinner.fail(`Error: Input file not found: ${summaryPath}`);
            process.exit(1);
        }

        // DoD: Implement actual task generation using the specified agent model
        spinner.update(`Generating tasks using ${useBAML() ? 'BAML' : agentModel}...`);

        let tasks: Task[];

        if (useBAML()) {
            // Use BAML for task generation
            const llmResponse = await safeReportGenerationAsync(
                () => generatePlanWithBAML(summaryContent, task),
                'task plan',
                'BAML generation',
                null
            );

            if (!llmResponse || !llmResponse.data || !llmResponse.data.tasks) {
                throw new Error('Failed to generate tasks using BAML. Response was invalid.');
            }
            // Map BAML types to local Task interface (convert PascalCase enums to lowercase)
            tasks = llmResponse.data.tasks.map(t => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority.toLowerCase() as 'high' | 'medium' | 'low',
                dependencies: t.dependencies,
                type: t.type
                    ? (t.type.toLowerCase() as 'bug' | 'enhancement' | 'debt' | 'docs' | 'refactor')
                    : undefined,
                completed: false,
            }));
        } else {
            // Use legacy provider-based approach
            let provider: LLMProvider;
            switch (agentModel.toLowerCase()) {
                case 'openai':
                    provider = new OpenAIProvider();
                    break;
                case 'gemini':
                    provider = new GeminiProvider();
                    break;
                case 'claude':
                default:
                    provider = new ClaudeProvider();
            }

            if (!provider.isAvailable()) {
                throw new TriumvirateError(
                    `API key for agent model '${agentModel}' not found.`,
                    ErrorCategory.AUTHENTICATION,
                    'PlanAction'
                );
            }

            // DoD: Pass the task option to the prompt generation function if provided
            const prompt = createPlanGenerationPrompt(summaryContent, task);
            const llmResponse = await safeReportGenerationAsync(
                () =>
                    provider.runStructured<{ tasks: Omit<Task, 'completed'>[] }>(
                        prompt,
                        planSchema
                    ),
                'task plan',
                'LLM generation',
                null
            );

            if (!llmResponse || !llmResponse.data || !llmResponse.data.tasks) {
                throw new Error(
                    `Failed to generate tasks using ${agentModel}. Response was invalid.`
                );
            }
            tasks = llmResponse.data.tasks.map(t => ({ ...t, completed: false }));
        }

        const plan: Plan = {
            tasks,
            metadata: {
                createdAt: new Date().toISOString(),
                sourceFile: summaryPath,
            },
        };

        // Write the plan to a file if output is specified
        if (output) {
            const outputPath = path.isAbsolute(output)
                ? output
                : path.resolve(process.cwd(), output);
            await safeFileOperationAsync(
                async () =>
                    fs.promises.writeFile(outputPath, JSON.stringify(plan, null, 2), 'utf8'),
                'write',
                outputPath,
                null
            );
            spinner.succeed(`Task plan generated and saved to: ${outputPath}`);
        } else {
            spinner.succeed('Task plan generated:');
            logger.log('\n' + JSON.stringify(plan, null, 2));
        }
        // Don't return anything for void return type
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        spinner.fail('Error generating task plan');
        // Error should be logged by safe wrappers or TriumvirateError handler
        process.exit(1);
    }
};

/**
 * Creates a prompt for the LLM to generate a task plan from a code review summary
 * @param summary The code review summary content
 * @param task Optional specific task description to focus on
 * @returns A formatted prompt for the LLM
 */
function createPlanGenerationPrompt(summary: string, task?: string): string {
    const taskGuidance = task
        ? `
# Specific Task Focus

${task}

When generating tasks, prioritize addressing the specific task described above.
`
        : '';

    return `
# Code Review Summary

${summary}${taskGuidance}

# Instructions

Based on the code review summary above, generate a list of actionable tasks.
Each task should address a specific issue, improvement, or feature mentioned in the summary.

For each task:
1. Assign a unique ID (e.g., task-1, task-2)
2. Create a concise title
3. Write a detailed description explaining what needs to be done
4. Assign a priority (high, medium, or low)
5. List any dependencies (other task IDs that must be completed first)
6. Assign a type (bug, enhancement, debt, docs, or refactor)

Ensure that the tasks are concrete, actionable, and directly related to the code review findings.
Prioritize tasks that address critical issues or have the highest impact.

Return the tasks in a structured format.
`;
}
