/**
 * Prompt template management for different review types
 */
import fs from 'fs';
import path from 'path';
import { ReviewType } from '../utils/constants';

/**
 * Result of loading a prompt template
 */
export interface PromptTemplateResult {
    baseTemplate: string;
    specificTemplate: string;
}

/**
 * Load a prompt template for a specific review type
 * @param reviewType - The type of review to generate a prompt for
 * @param directoryStructure - The directory structure of the codebase
 * @param summary - A summary of the codebase
 * @returns The generated prompt template
 */
export function loadPromptTemplate(
    reviewType: string,
    directoryStructure: string,
    summary: string
): string {
    const baseTemplatePath = path.join(__dirname, 'base.txt');
    let specificTemplatePath: string;

    // Determine which specific template to use based on review type
    switch (reviewType.toLowerCase()) {
        case ReviewType.SECURITY:
            specificTemplatePath = path.join(__dirname, 'security.txt');
            break;
        case ReviewType.PERFORMANCE:
            specificTemplatePath = path.join(__dirname, 'performance.txt');
            break;
        case ReviewType.ARCHITECTURE:
            specificTemplatePath = path.join(__dirname, 'architecture.txt');
            break;
        case ReviewType.DOCS:
            specificTemplatePath = path.join(__dirname, 'docs.txt');
            break;
        case ReviewType.GENERAL:
        default:
            specificTemplatePath = path.join(__dirname, 'general.txt');
            break;
    }

    try {
        // Read the base template and specific template
        let baseTemplate = fs.readFileSync(baseTemplatePath, 'utf8');
        const specificTemplate = fs.readFileSync(specificTemplatePath, 'utf8');

        // Replace placeholders in the base template
        baseTemplate = baseTemplate
            .replace('{{DIRECTORY_STRUCTURE}}', directoryStructure)
            .replace('{{SUMMARY}}', summary);

        // Combine the templates
        return `${baseTemplate}\n\n${specificTemplate}`;
    } catch (error) {
        console.error(`Error loading prompt template: ${error}`);
        throw new Error(`Failed to load prompt template for review type: ${reviewType}`);
    }
}
