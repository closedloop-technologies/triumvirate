/**
 * Badge generation utilities for Triumvirate code reviews
 *
 * Generates shields.io badge URLs and can optionally embed them in README.md
 */

import * as fs from 'fs';
import * as path from 'path';

import type { CodeReviewReport } from '../types/report.js';

/**
 * Badge status based on review results
 */
export type BadgeStatus = 'passed' | 'warnings' | 'failed' | 'error';

/**
 * Badge configuration
 */
export interface BadgeConfig {
    label?: string;
    style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge' | 'social';
}

/**
 * Badge result containing the URL and markdown
 */
export interface BadgeResult {
    status: BadgeStatus;
    url: string;
    markdown: string;
    summary: string;
}

/**
 * Determine badge status from a CodeReviewReport
 */
export function determineBadgeStatus(report: CodeReviewReport): BadgeStatus {
    const findings = Object.values(report.findingsByCategory || {}).flat();
    const improvements = findings.filter(f => !f.isStrength);

    // Count high-agreement issues (all 3 models agree)
    const highAgreementIssues = improvements.filter(
        f => Object.values(f.modelAgreements).filter(Boolean).length >= 3
    );

    // Count partial-agreement issues (2 models agree)
    const partialAgreementIssues = improvements.filter(
        f => Object.values(f.modelAgreements).filter(Boolean).length === 2
    );

    // Determine status based on findings
    if (highAgreementIssues.length > 0) {
        return 'failed';
    } else if (partialAgreementIssues.length > 0) {
        return 'warnings';
    } else if (improvements.length > 0) {
        return 'passed'; // Only low-agreement issues
    }

    return 'passed';
}

/**
 * Get badge color based on status
 */
function getBadgeColor(status: BadgeStatus): string {
    switch (status) {
        case 'passed':
            return 'brightgreen';
        case 'warnings':
            return 'yellow';
        case 'failed':
            return 'red';
        case 'error':
            return 'lightgrey';
        default:
            return 'lightgrey';
    }
}

/**
 * Get badge message based on status
 */
function getBadgeMessage(status: BadgeStatus): string {
    switch (status) {
        case 'passed':
            return 'Passed';
        case 'warnings':
            return 'Warnings';
        case 'failed':
            return 'Issues Found';
        case 'error':
            return 'Error';
        default:
            return 'Unknown';
    }
}

/**
 * Generate a shields.io badge URL for the review results
 */
export function generateBadgeUrl(status: BadgeStatus, config: BadgeConfig = {}): string {
    const { label = 'Triumvirate', style = 'flat' } = config;

    const color = getBadgeColor(status);
    const message = getBadgeMessage(status);

    // URL encode the label and message
    const encodedLabel = encodeURIComponent(label);
    const encodedMessage = encodeURIComponent(message);

    return `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${color}?style=${style}`;
}

/**
 * Generate badge markdown from a CodeReviewReport
 */
export function generateBadgeFromReport(
    report: CodeReviewReport,
    config: BadgeConfig = {}
): BadgeResult {
    const status = determineBadgeStatus(report);
    const url = generateBadgeUrl(status, config);

    const findings = Object.values(report.findingsByCategory || {}).flat();
    const improvements = findings.filter(f => !f.isStrength);
    const strengths = findings.filter(f => f.isStrength);

    const highAgreement = improvements.filter(
        f => Object.values(f.modelAgreements).filter(Boolean).length >= 3
    ).length;
    const partialAgreement = improvements.filter(
        f => Object.values(f.modelAgreements).filter(Boolean).length === 2
    ).length;

    const summary = `${strengths.length} strengths, ${improvements.length} improvements (${highAgreement} 🚨, ${partialAgreement} ❗)`;

    return {
        status,
        url,
        markdown: `![Triumvirate](${url})`,
        summary,
    };
}

/**
 * Badge marker comments for README.md
 */
const BADGE_START_MARKER = '<!-- triumvirate-badge-start -->';
const BADGE_END_MARKER = '<!-- triumvirate-badge-end -->';

/**
 * Generate the full badge block with markers
 */
function generateBadgeBlock(badgeResult: BadgeResult): string {
    return `${BADGE_START_MARKER}\n${badgeResult.markdown}\n${BADGE_END_MARKER}`;
}

/**
 * Update or insert a Triumvirate badge in a README file
 *
 * @param readmePath - Path to the README.md file
 * @param badgeResult - The badge result to embed
 * @returns true if the file was updated, false if no changes were needed
 */
export function updateReadmeBadge(readmePath: string, badgeResult: BadgeResult): boolean {
    const resolvedPath = path.resolve(readmePath);

    if (!fs.existsSync(resolvedPath)) {
        console.warn(`README file not found: ${resolvedPath}`);
        return false;
    }

    let content = fs.readFileSync(resolvedPath, 'utf-8');
    const badgeBlock = generateBadgeBlock(badgeResult);

    // Check if badge markers already exist
    const startIndex = content.indexOf(BADGE_START_MARKER);
    const endIndex = content.indexOf(BADGE_END_MARKER);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Replace existing badge block
        const before = content.substring(0, startIndex);
        const after = content.substring(endIndex + BADGE_END_MARKER.length);
        content = before + badgeBlock + after;
    } else {
        // Insert badge after the first heading or at the top
        const firstHeadingMatch = content.match(/^#\s+.+$/m);
        if (firstHeadingMatch && firstHeadingMatch.index !== undefined) {
            const insertIndex = firstHeadingMatch.index + firstHeadingMatch[0].length;
            content =
                content.substring(0, insertIndex) +
                '\n\n' +
                badgeBlock +
                '\n' +
                content.substring(insertIndex);
        } else {
            // No heading found, insert at the top
            content = badgeBlock + '\n\n' + content;
        }
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
    return true;
}

/**
 * Find the README.md file in a directory
 */
export function findReadme(directory: string = '.'): string | null {
    const resolvedDir = path.resolve(directory);
    const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const candidate of candidates) {
        const candidatePath = path.join(resolvedDir, candidate);
        if (fs.existsSync(candidatePath)) {
            return candidatePath;
        }
    }

    return null;
}

/**
 * Embed a Triumvirate badge in the project's README.md
 *
 * @param report - The CodeReviewReport to generate the badge from
 * @param options - Options for badge generation
 * @returns The badge result, or null if README was not found
 */
export function embedBadgeInReadme(
    report: CodeReviewReport,
    options: {
        readmePath?: string;
        config?: BadgeConfig;
    } = {}
): BadgeResult | null {
    const { readmePath, config } = options;

    // Find README if not specified
    const targetPath = readmePath || findReadme();
    if (!targetPath) {
        console.warn('No README.md found in the current directory');
        return null;
    }

    const badgeResult = generateBadgeFromReport(report, config);
    const updated = updateReadmeBadge(targetPath, badgeResult);

    if (updated) {
        console.log(`✅ Badge embedded in ${targetPath}`);
        console.log(`   Status: ${badgeResult.status} - ${badgeResult.summary}`);
    }

    return badgeResult;
}
