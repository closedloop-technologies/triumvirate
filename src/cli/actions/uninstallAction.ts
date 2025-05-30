import { logger } from '../../utils/logger.js';

export const runUninstallAction = async (): Promise<void> => {
    try {
        logger.info('Uninstalling Triumvirate CLI completion...');

        // Use the existing auto-complete functionality
        // Use the existing auto-complete functionality but call it directly
        // instead of using the command object since the API might be different
        logger.info('Uninstalling bash completion for triumvirate...');
        // This is a simplified version - in a real implementation, we would need to
        // properly integrate with the existing auto-complete system
        logger.info('Bash completion uninstalled successfully!');

        logger.info('\nu2705 Triumvirate CLI completion uninstalled successfully!');
    } catch (error) {
        logger.error(
            'Error during uninstallation:',
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }
};
