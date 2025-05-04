import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import _pc from 'picocolors';

import { safeExecute, safeFileOperation } from '../../utils/error-handling.js';
import { logger } from '../../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface NextOptions {
    input?: string;
    outputDir?: string; // DoD: Add output directory option
    markComplete?: string; // DoD: Add option to mark a task as complete
    branch?: boolean; // DoD: Add option to create git branch for task
    verbose?: boolean;
    quiet?: boolean;
}

interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    type?: 'bug' | 'enhancement' | 'debt' | 'docs' | 'refactor'; // DoD: Add optional type field
    completed: boolean;
}

interface Plan {
    tasks: Task[];
    metadata: {
        createdAt: string;
        sourceFile: string;
    };
}

export const runNextAction = async (options: NextOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.debug('options:', options);

    const { input, outputDir = './.justbuild', markComplete, branch } = options; // DoD: Extract all options

    if (!input) {
        logger.error('Error: Input file is required. Use --input to specify the plan file.');
        process.exit(1);
    }

    // Create a spinner for progress reporting
    const spinner = new Spinner('Finding next available task...', {
        quiet: options.quiet,
        verbose: options.verbose,
    });
    spinner.start();

    try {
        const planPath = path.resolve(process.cwd(), input);
        spinner.update(`Reading plan file: ${planPath}`);
        const planContent = safeFileOperation(
            () => fs.readFileSync(planPath, 'utf8'),
            'read',
            planPath,
            null
        );

        if (planContent === null) {
            spinner.fail(`Error: Plan file not found: ${planPath}`);
            process.exit(1);
        }
        const plan = safeExecute<Plan, null>(
            () => JSON.parse(planContent),
            'JSON Parse',
            null,
            'error'
        );
        if (!plan) {
            spinner.fail('Error: Failed to parse plan file. Ensure it is valid JSON.');
            process.exit(1);
        }

        // If markComplete is specified, mark the task as completed and save the updated plan
        if (markComplete) {
            spinner.update(`Marking task ${markComplete} as completed...`);
            const updatedPlan = markTaskAsCompleted(plan, markComplete);
            if (updatedPlan) {
                // Ensure the output directory exists
                const outputDirPath = path.resolve(process.cwd(), outputDir);
                safeFileOperation(
                    () => {
                        if (!fs.existsSync(outputDirPath)) {
                            fs.mkdirSync(outputDirPath, { recursive: true });
                        }
                    },
                    'create',
                    outputDirPath,
                    null
                );

                // Save the updated plan
                const outputPath = path.resolve(outputDirPath, path.basename(planPath));
                safeFileOperation(
                    () =>
                        fs.writeFileSync(outputPath, JSON.stringify(updatedPlan, null, 2), 'utf8'),
                    'write',
                    outputPath,
                    null
                );
                spinner.succeed(`Task ${markComplete} marked as completed and plan updated.`);

                // Find the next available task after marking this one as completed
                const nextTask = findNextAvailableTask(updatedPlan);
                if (nextTask) {
                    logger.log('\nNext available task:');
                    logger.log(formatTask(nextTask));
                } else {
                    logger.log(
                        '\nNo more available tasks. All tasks are either completed or blocked by dependencies.'
                    );
                }
                return;
            } else {
                spinner.fail(`Task ${markComplete} not found in the plan.`);
                process.exit(1);
            }
        }

        // Find the next available task
        spinner.update('Analyzing dependencies and finding next task...');
        const nextTask = findNextAvailableTask(plan);

        if (nextTask) {
            spinner.succeed('Next available task found:');
            logger.log('\n' + formatTask(nextTask));

            // If branch option is specified, create a git branch for the task
            if (branch) {
                spinner.update('Creating git branch for task...');
                const branchCreated = await createGitBranchForTask(nextTask);
                if (branchCreated) {
                    spinner.succeed(`Git branch created and checked out: ${branchCreated}`);
                } else {
                    spinner.fail(
                        'Failed to create git branch. Make sure git is installed and you are in a git repository.'
                    );
                }
            }
        } else {
            spinner.succeed(
                'No available tasks found. All tasks are either completed or blocked by dependencies.'
            );
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        spinner.fail('Error finding next task');
        // Error is already logged by safe wrappers or thrown TriumvirateError
        process.exit(1);
    }
};

// Find the next available task based on dependencies and completion status
function findNextAvailableTask(plan: Plan): Task | null {
    const { tasks: _tasks } = plan;

    // Filter tasks that are not completed and have all dependencies completed
    let availableTasks = plan.tasks.filter(task => {
        if (task.completed) {
            return false; // Skip completed tasks
        }

        // Check if all dependencies are completed
        return task.dependencies.every(depId => {
            const dependency = plan.tasks.find(t => t.id === depId);
            return dependency ? dependency.completed : false;
        });
    });

    if (availableTasks.length === 0) {
        return null;
    }

    // Sort available tasks by priority (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    // Handle potential invalid priority values gracefully
    availableTasks = availableTasks.filter(task => task.priority in priorityOrder);

    availableTasks.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Return the highest priority task
    return availableTasks[0] || null;
}

/**
 * Mark a task as completed in the plan
 * @param plan The plan containing the tasks
 * @param taskId The ID of the task to mark as completed
 * @returns The updated plan, or null if the task was not found
 */
function markTaskAsCompleted(plan: Plan, taskId: string): Plan | null {
    // Create a deep copy of the plan to avoid modifying the original
    const updatedPlan: Plan = JSON.parse(JSON.stringify(plan));

    // Find the task with the given ID
    const taskIndex = updatedPlan.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
        return null; // Task not found
    }

    // Mark the task as completed
    // We've already checked that taskIndex !== -1, so this is safe
    updatedPlan.tasks[taskIndex]!.completed = true;

    return updatedPlan;
}

// Format a task for display with improved formatting
/**
 * Create a git branch for a task
 * @param task The task to create a branch for
 * @returns The name of the created branch, or null if creation failed
 */
async function createGitBranchForTask(task: Task): Promise<string | null> {
    try {
        // Create a branch name from the task ID and title
        // Replace spaces and special characters with hyphens, convert to lowercase
        const taskType = task.type && typeof task.type === 'string' ? `${task.type}-` : '';
        const branchName = `task-${taskType}${task.id}-${task.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')}`;

        // Check if git is installed and we're in a git repository
        try {
            execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            logger.error('Not in a git repository or git is not installed');
            return null;
        }

        // Create and checkout the branch
        execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' });

        return branchName;
    } catch (err) {
        logger.error(
            'Error creating git branch:',
            err instanceof Error ? err.message : String(err)
        );
        return null;
    }
}

function formatTask(task: Task): string {
    const priorityColor = {
        high: '\x1b[31m', // Red for high priority
        medium: '\x1b[33m', // Yellow for medium priority
        low: '\x1b[32m', // Green for low priority
    };
    const resetColor = '\x1b[0m';

    // Format the task type with a badge if available
    const typeDisplay =
        task.type && typeof task.type === 'string' ? `[${task.type.toUpperCase()}] ` : '';

    // Default to medium priority if not specified or invalid
    const priority = task.priority && priorityColor[task.priority] ? task.priority : 'medium';

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${priorityColor[priority]}${priority.toUpperCase()} PRIORITY${resetColor} - ${typeDisplay}${task.title} (${task.id})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Description:
  ${task.description.replace(/\n/g, '\n  ')}

Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}
`;
}
