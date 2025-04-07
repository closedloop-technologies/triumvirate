import { logger } from './logger.js';

// Constants for support links
const TRIUMVIRATE_ISSUES_URL = 'https://github.com/closedloop-technologies/triumvirate/issues';

export class TriumvirateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TriumvirateError';
    }
}

export const handleError = (error: unknown): void => {
    logger.log('');

    if (error instanceof TriumvirateError) {
        logger.error(`u2716 ${error.message}`);
        // If expected error, show stack trace for debugging
        logger.debug('Stack trace:', error.stack);
    } else if (error instanceof Error) {
        logger.error(`u2716 Unexpected error: ${error.message}`);
        // If unexpected error, show stack trace by default
        logger.note('Stack trace:', error.stack);

        if (logger.getLogLevel() < 3) {
            // Debug level
            logger.log('');
            logger.note('For detailed debug information, use the --verbose flag');
        }
    } else {
        // Unknown errors
        logger.error('u2716 An unknown error occurred');

        if (logger.getLogLevel() < 3) {
            // Debug level
            logger.note('For detailed debug information, use the --verbose flag');
        }
    }

    // Community support information
    logger.log('');
    logger.info('Need help?');
    logger.info(`• File an issue on GitHub: ${TRIUMVIRATE_ISSUES_URL}`);
};
