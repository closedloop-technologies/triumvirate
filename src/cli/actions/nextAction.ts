import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface NextOptions {
    input?: string;
    verbose?: boolean;
    quiet?: boolean;
}

interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
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

    const { input } = options;

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
        // Read the plan file
        const planPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(planPath)) {
            spinner.fail(`Error: Plan file not found: ${planPath}`);
            process.exit(1);
        }

        const planContent = fs.readFileSync(planPath, 'utf8');
        let plan: Plan;

        try {
            plan = JSON.parse(planContent);
        } catch (error) {
            spinner.fail(
                `Error: Failed to parse plan file: ${error instanceof Error ? error.message : String(error)}`
            );
            process.exit(1);
        }

        // Find the next available task
        spinner.update('Analyzing dependencies and finding next task...');
        const nextTask = findNextAvailableTask(plan);

        if (nextTask) {
            spinner.succeed('Next available task found:');
            logger.log('\n' + formatTask(nextTask));
        } else {
            spinner.succeed(
                'No available tasks found. All tasks are either completed or blocked by dependencies.'
            );
        }
    } catch (error) {
        spinner.fail('Error finding next task');
        logger.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
};

// Find the next available task based on dependencies and completion status
function findNextAvailableTask(plan: Plan): Task | null {
    const { tasks } = plan;

    // Get all completed task IDs
    const completedTaskIds = new Set(tasks.filter(task => task.completed).map(task => task.id));

    // Find tasks that are not completed and have all dependencies satisfied
    const availableTasks = tasks.filter(task => {
        // Skip completed tasks
        if (task.completed) {
            return false;
        }

        // Check if all dependencies are completed
        return task.dependencies.every(depId => completedTaskIds.has(depId));
    });

    if (availableTasks.length === 0) {
        return null;
    }

    // Sort available tasks by priority (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    availableTasks.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Return the highest priority task
    return availableTasks[0] || null;
}

// Format a task for display
function formatTask(task: Task): string {
    return `Task ID: ${task.id}\nTitle: ${task.title}\nPriority: ${task.priority}\nDescription: ${task.description}\nDependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}`;
}
