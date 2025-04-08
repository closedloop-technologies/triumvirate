import * as fs from 'fs';
import * as path from 'path';

import type { ModelResult } from '../../types/model-responses';
import { logger } from '../../utils/logger.js';
import { formatReportAsMarkdown, generateCodeReviewReport } from '../../utils/report-utils.js';
import { Spinner } from '../utils/spinner.js';

interface SummarizeOptions {
    input?: string;
    output?: string;
    enhancedReport?: boolean;
    verbose?: boolean;
    quiet?: boolean;
}

export const runSummarizeAction = async (options: SummarizeOptions) => {
    // Set log level based on verbose and quiet flags
    if (options.quiet) {
        logger.setLogLevel('silent');
    } else if (options.verbose) {
        logger.setLogLevel('debug');
    } else {
        logger.setLogLevel('info');
    }

    logger.debug('options:', options);

    const {
        input,
        output,
        // enhancedReport is not used in this implementation
        // as the generateCodeReviewReport function doesn't take it as a parameter
    } = options;

    if (!input) {
        logger.error('Error: Input file is required. Use --input to specify the raw reports file.');
        process.exit(1);
    }

    // Create a spinner for progress reporting
    const spinner = new Spinner('Generating summary from raw reports...', {
        quiet: options.quiet,
        verbose: options.verbose,
    });
    spinner.start();

    try {
        // Read the raw reports file
        const rawReportsPath = path.resolve(process.cwd(), input);
        if (!fs.existsSync(rawReportsPath)) {
            spinner.fail(`Error: Input file not found: ${rawReportsPath}`);
            process.exit(1);
        }

        const rawReportsContent = fs.readFileSync(rawReportsPath, 'utf8');
        let rawReports;

        try {
            rawReports = JSON.parse(rawReportsContent);
        } catch (error) {
            spinner.fail(
                `Error: Failed to parse raw reports file: ${error instanceof Error ? error.message : String(error)}`
            );
            process.exit(1);
        }

        // Generate the summary report
        spinner.update('Generating summary report...');
        const report = await generateCodeReviewReport(rawReports as ModelResult[]);

        // Format the report as markdown
        const formattedReport = formatReportAsMarkdown(report);

        // Write the report to a file if output is specified
        if (output) {
            const outputPath = path.resolve(process.cwd(), output);
            fs.writeFileSync(outputPath, formattedReport, 'utf8');
            spinner.succeed(`Summary report generated and saved to: ${outputPath}`);
        } else {
            spinner.succeed('Summary report generated:');
            logger.log('\n' + formattedReport);
        }
    } catch (error) {
        spinner.fail('Error generating summary report');
        logger.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
};
