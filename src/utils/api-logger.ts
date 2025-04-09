import * as fs from 'fs';
import * as path from 'path';

import pc from 'picocolors';

// Define the log file path
const LOG_FILE_PATH = path.join(process.cwd(), 'api-calls.jsonl');

// Interface for API call logs
export interface ApiCallLog {
    timestamp: string;
    model: string;
    operation: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    success: boolean;
    error?: string;
    cost?: number;
}

/**
 * Log an API call to both terminal and JSONL file
 */
export function logApiCall(logData: ApiCallLog): void {
    // Format timestamp
    const timestamp = logData.timestamp || new Date().toISOString();

    // Create log entry for JSONL file
    const jsonlEntry = JSON.stringify({
        ...logData,
        timestamp,
    });

    // Append to JSONL file
    try {
        fs.appendFileSync(LOG_FILE_PATH, jsonlEntry + '\n');
    } catch (error) {
        console.error(`Error writing to API log file: ${(error as Error).message}`);
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
        logData.cost !== undefined && logData.cost !== null ? `$${logData.cost.toFixed(4)}` : '';

    // Format timestamp for display
    const formattedTime = timestamp.includes('T')
        ? timestamp.split('T')[1]?.split('.')?.[0] || timestamp
        : timestamp;

    // Create model identifier with arcade-style formatting
    const modelIdentifier = getModelIcon(logData.model) + ' ' + pc.cyan(logData.model);

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

    console.log(logMessage);
}

/**
 * Get an icon representation for a specific model
 */
function getModelIcon(model: string): string {
    const modelLower = model.toLowerCase();

    if (modelLower.includes('gpt') || modelLower.includes('openai')) {
        return '🧠'; // Brain for OpenAI
    }

    if (modelLower.includes('claude')) {
        return '🔮'; // Crystal ball for Claude
    }

    if (modelLower.includes('gemini')) {
        return '💎'; // Gem for Gemini
    }

    return '🤖'; // Robot for unknown models
}

/**
 * Initialize the API logger
 */
export function initApiLogger(): void {
    // Create the log directory if it doesn't exist
    const logDir = path.dirname(LOG_FILE_PATH);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // Log initialization
    console.log(`API call logging initialized. Logs will be saved to: ${LOG_FILE_PATH}`);
}
