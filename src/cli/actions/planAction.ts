import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface PlanOptions {
    input?: string;
    output?: string;
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

export const runPlanAction = async (options: PlanOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.debug('options:', options);

    const { input, output } = options;

    if (!input) {
        logger.error('Error: Input file is required. Use --input to specify the summary file.');
        process.exit(1);
    }

    // Create a spinner for progress reporting
    const spinner = new Spinner('Generating task plan from summary...', {
        quiet: options.quiet,
        verbose: options.verbose,
    });
    spinner.start();

    try {
        // Read the summary file
        const summaryPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(summaryPath)) {
            spinner.fail(`Error: Input file not found: ${summaryPath}`);
            process.exit(1);
        }

        const summaryContent = fs.readFileSync(summaryPath, 'utf8');

        // Generate tasks from the summary
        spinner.update('Analyzing summary and generating tasks...');

        // This is a placeholder for the actual task generation logic
        // In a real implementation, this would use an LLM or other analysis to extract tasks
        const tasks = generateTasksFromSummary(summaryContent);

        const plan: Plan = {
            tasks,
            metadata: {
                createdAt: new Date().toISOString(),
                sourceFile: summaryPath,
            },
        };

        // Write the plan to a file if output is specified
        if (output) {
            const outputPath = path.resolve(process.cwd(), output);
            fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2), 'utf8');
            spinner.succeed(`Task plan generated and saved to: ${outputPath}`);
        } else {
            spinner.succeed('Task plan generated:');
            logger.log('\n' + JSON.stringify(plan, null, 2));
        }
    } catch (error) {
        spinner.fail('Error generating task plan');
        logger.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
};

// This is a placeholder function that would be replaced with actual LLM-based task extraction
function generateTasksFromSummary(summaryContent: string): Task[] {
    // This is a simplified implementation that creates placeholder tasks
    // In a real implementation, this would use NLP or an LLM to extract tasks from the summary

    // Extract potential tasks from headings or bullet points
    const headingMatches = summaryContent.match(/#{1,3}\s+([^\n]+)/g) || [];
    const bulletMatches = summaryContent.match(/[-*]\s+([^\n]+)/g) || [];

    const potentialTasks = [...headingMatches, ...bulletMatches];

    // Create tasks from the potential tasks
    return potentialTasks.slice(0, Math.min(potentialTasks.length, 10)).map((task, index) => {
        const cleanedTask = task.replace(/^[-*#\s]+/, '').trim();
        return {
            id: `task-${index + 1}`,
            title: cleanedTask,
            description: `Task extracted from: "${cleanedTask}"`,
            priority: index < 3 ? 'high' : index < 7 ? 'medium' : 'low',
            dependencies: index > 0 ? [`task-${index}`] : [],
            completed: false,
        };
    });
}
