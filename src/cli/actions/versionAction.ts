import { logger } from '../../utils/logger.js';

export const runVersionAction = async (): Promise<void> => {
    try {
        const { version } = await import('../../../package.json');
        logger.log(`Triumvirate v${version}`);
    } catch (error) {
        logger.error('Error retrieving version information:', error);
    }
};
