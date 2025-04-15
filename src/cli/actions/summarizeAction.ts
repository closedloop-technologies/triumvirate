import * as fs from 'fs';
import * as path from 'path';

import type { ModelResult } from '../../types/model-responses';
import { enhancedLogger } from '../../utils/enhanced-logger.js';
import {
    formatReportAsMarkdown,
    generateCodeReviewReport,
    logModelResults,
} from '../../utils/report-utils.js';
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
        enhancedLogger.setLogLevel('silent');
    } else if (options.verbose) {
        enhancedLogger.setLogLevel('debug');
    } else {
        enhancedLogger.setLogLevel('info');
    }

    // Initialize the API logger
    enhancedLogger.initApiLogger();

    enhancedLogger.debug('options:', options);

    const {
        input,
        output,
        // enhancedReport is not used in this implementation
        // as the generateCodeReviewReport function doesn't take it as a parameter
    } = options;

    if (!input) {
        enhancedLogger.error(
            'Error: Input file is required. Use --input to specify the raw reports file.'
        );
        process.exit(1);
    }
    if (!output) {
        enhancedLogger.error(
            'Error: Output file is required. Use --output to specify the summary file.'
        );
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
            enhancedLogger.printApiSummary();
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
            enhancedLogger.printApiSummary();
            process.exit(1);
        }

        logModelResults(rawReports);
        // (Optional) If you want to log API calls for summarize, you can add enhancedLogger.logApiCall() here as needed.
        // Generate the summary report
        const report = await generateCodeReviewReport(rawReports as ModelResult[], spinner);

        // Format the report as markdown
        const formattedReport = formatReportAsMarkdown(report);

        enhancedLogger.printApiSummary();

        // Write the report to a file
        const outputPath = path.resolve(process.cwd(), output);
        fs.writeFileSync(outputPath, formattedReport, 'utf8');
        spinner.succeed(`Summary report generated and saved to: ${outputPath}`);
    } catch (error) {
        spinner.fail('Error generating summary report');
        enhancedLogger.error('Error:', error instanceof Error ? error.message : String(error));
        enhancedLogger.printApiSummary();
        process.exit(1);
    }
};
