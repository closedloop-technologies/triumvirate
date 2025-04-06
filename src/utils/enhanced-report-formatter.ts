// DEPRECATED: This module has been consolidated into report-utils.ts
// Please use formatReportAsMarkdown from report-utils.ts instead
import { type CodeReviewReport } from '../types/report';
import { formatReportAsMarkdown } from './report-utils';

/**
 * @deprecated This function has been moved to report-utils.ts. Please use formatReportAsMarkdown from report-utils.ts instead.
 * Enhanced format for the report as Markdown
 * Includes improvements to address issues with the current report format:
 * 1. Fixes the Model Agreement Analysis section
 * 2. Adds missing Priority Recommendations
 * 3. Improves Category Extraction
 * 4. Enhances Executive Summary
 * 5. Adds Visual Elements (where possible in markdown)
 * 6. Improves Code Example Formatting
 */
export function enhancedFormatReportAsMarkdown(report: CodeReviewReport): string {
    console.warn('enhancedFormatReportAsMarkdown is deprecated. Use formatReportAsMarkdown from report-utils.ts instead.');
    return formatReportAsMarkdown(report);
}
