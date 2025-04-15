import * as fs from 'fs';
import * as path from 'path';

import pc from 'picocolors';

import type { ApiCallLog } from './api-logger.js';
import { logger } from './logger.js';
import type { LogLevel } from './logger.js';

// Define the log file path
const LOG_FILE_PATH = path.join(process.cwd(), 'tri-review-api-calls.jsonl');

/**
 * Enhanced logger that extends the base logger with API call tracking capabilities
 */
export class EnhancedLogger {
    private apiCalls: ApiCallLog[] = [];
    private totalCost: number = 0;
    private totalInputTokens: number = 0;
    private totalOutputTokens: number = 0;
    private totalApiCalls: number = 0;
    private modelCallCounts: Record<string, number> = {};
    private modelCosts: Record<string, number> = {};

    /**
     * Set the log level for the underlying logger
     */
    setLogLevel(level: LogLevel | number): void {
        logger.setLogLevel(level);
    }

    /**
     * Get the current log level from the underlying logger
     */
    getLogLevel(): number {
        return logger.getLogLevel();
    }

    /**
     * Standard logging methods that delegate to the underlying logger
     */
    log(...args: unknown[]): void {
        logger.log(...args);
    }

    error(...args: unknown[]): void {
        logger.error(...args);
    }

    warn(...args: unknown[]): void {
        logger.warn(...args);
    }

    info(...args: unknown[]): void {
        logger.info(...args);
    }

    note(...args: unknown[]): void {
        logger.note(...args);
    }

    debug(...args: unknown[]): void {
        logger.debug(...args);
    }

    trace(...args: unknown[]): void {
        logger.trace(...args);
    }

    /**
     * Log an API call to both terminal and JSONL file, while also tracking it for summary reporting
     */
    logApiCall(logData: ApiCallLog): void {
        // Format timestamp if not provided
        const timestamp = logData.timestamp || new Date().toISOString();
        const enhancedLogData = {
            ...logData,
            timestamp,
        };

        // Add to in-memory tracking
        this.apiCalls.push(enhancedLogData);
        this.totalApiCalls++;

        // Track model usage
        if (logData.model) {
            this.modelCallCounts[logData.model] = (this.modelCallCounts[logData.model] || 0) + 1;
        }

        // Track costs and tokens
        if (logData.cost !== undefined && logData.cost !== null) {
            this.totalCost += logData.cost;
            if (logData.model) {
                this.modelCosts[logData.model] =
                    (this.modelCosts[logData.model] || 0) + logData.cost;
            }
        }

        if (logData.inputTokens) {
            this.totalInputTokens += logData.inputTokens;
        }

        if (logData.outputTokens) {
            this.totalOutputTokens += logData.outputTokens;
        }

        // Create log entry for JSONL file
        const jsonlEntry = JSON.stringify(enhancedLogData);

        // Append to JSONL file
        try {
            fs.appendFileSync(LOG_FILE_PATH, jsonlEntry + '\n');
        } catch (error) {
            this.error(`Error writing to API log file: ${(error as Error).message}`);
        }

        // Skip console output if this is a structured output call (to avoid cluttering the terminal)
        if (logData.operation === 'structured_output') {
            return;
        }

        // Log to terminal in a stylized format with hacker/arcade game aesthetic
        const statusColor = logData.success ? pc.green : pc.red;
        const statusSymbol = logData.success ? '█' : '░'; // Use block characters for status

        // Format tokens if available with arcade-style brackets
        const tokensInfo =
            logData.totalTokens !== undefined
                ? `⟨${logData.inputTokens || 0}⟩⟨${logData.outputTokens || 0}⟩`
                : '';

        // Format latency if available
        const latencyInfo = logData.latencyMs ? `${logData.latencyMs}ms` : '';

        // Format cost if available with arcade-style credits
        const costInfo =
            logData.cost !== undefined && logData.cost !== null
                ? `$${logData.cost.toFixed(4)}`
                : '';

        // Format timestamp for display
        const formattedTime = timestamp.includes('T')
            ? timestamp.split('T')[1]?.split('.')?.[0] || timestamp
            : timestamp;

        // Create model identifier with arcade-style formatting
        const modelIdentifier = '🤖 ' + pc.cyan(logData.model);

        // Build the terminal log message
        const logMessage = [
            pc.gray(`⟨${formattedTime}⟩`),
            statusColor(statusSymbol.repeat(2)),
            modelIdentifier,
            pc.yellow(logData.operation.toUpperCase()),
            tokensInfo ? pc.blue(tokensInfo) : '',
            latencyInfo ? pc.magenta(`⌚${latencyInfo}`) : '',
            costInfo ? pc.green(costInfo) : '',
            logData.error ? pc.red(`! ${logData.error}`) : '',
        ]
            .filter((part): part is string => Boolean(part))
            .join(' ');

        this.log(logMessage);
    }

    /**
     * Initialize the API logger
     */
    initApiLogger(): void {
        // Reset tracking stats
        this.apiCalls = [];
        this.totalCost = 0;
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalApiCalls = 0;
        this.modelCallCounts = {};
        this.modelCosts = {};

        // Create the log directory if it doesn't exist
        const logDir = path.dirname(LOG_FILE_PATH);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Log initialization
        this.info(`API call logging initialized. Logs will be saved to: ${LOG_FILE_PATH}`);
    }

    /**
     * Print a summary of API usage and costs
     */
    printApiSummary(): void {
        if (this.totalApiCalls === 0) {
            this.note('No API calls were made during this operation.');
            return;
        }

        const totalTokens = this.totalInputTokens + this.totalOutputTokens;

        this.note('\n📊 API USAGE SUMMARY 📊');
        this.note('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.note(`Total API Calls: ${pc.cyan(this.totalApiCalls.toString())}`);
        this.note(`Total Cost: ${pc.green('$' + this.totalCost.toFixed(4))}`);
        this.note(
            `Total Tokens: ${pc.blue(totalTokens.toString())} (${pc.blue(this.totalInputTokens.toString())} input, ${pc.blue(this.totalOutputTokens.toString())} output)`
        );

        // Print model-specific stats
        if (Object.keys(this.modelCallCounts).length > 0) {
            this.note('\n📱 MODEL BREAKDOWN 📱');
            this.note('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            Object.keys(this.modelCallCounts).forEach(model => {
                const callCount = this.modelCallCounts[model];
                const cost = this.modelCosts[model] || 0;

                this.note(
                    `${pc.cyan(model)}: ${callCount} calls, ${pc.green('$' + cost.toFixed(4))}`
                );
            });
        }

        this.note('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * Get the current API usage statistics
     */
    getApiStats() {
        return {
            totalCalls: this.totalApiCalls,
            totalCost: this.totalCost,
            totalInputTokens: this.totalInputTokens,
            totalOutputTokens: this.totalOutputTokens,
            modelCallCounts: { ...this.modelCallCounts },
            modelCosts: { ...this.modelCosts },
        };
    }
}

// Export a singleton instance
export const enhancedLogger = new EnhancedLogger();
