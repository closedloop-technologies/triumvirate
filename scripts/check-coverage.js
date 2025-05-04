#!/usr/bin/env node

/**
 * Test Coverage Check Script
 *
 * This script runs tests with coverage and verifies that coverage meets the minimum threshold.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
};

// Coverage thresholds
const thresholds = {
    lines: 70,
    functions: 70,
    branches: 60,
    statements: 70,
};

// Run tests with coverage
function runTestsWithCoverage() {
    try {
        const output = execSync('npx vitest run --coverage', {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: 'pipe',
        });
        return { success: true, output };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
        };
    }
}

// Parse coverage from output
function parseCoverage(output) {
    const coverage = {};

    // This is a simplified parser - adjust based on your coverage output format
    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('% Lines')) {
            const match = line.match(/(\d+(\.\d+)?)% Lines/);
            if (match) {
                coverage.lines = parseFloat(match[1]);
            }
        }
        if (line.includes('% Functions')) {
            const match = line.match(/(\d+(\.\d+)?)% Functions/);
            if (match) {
                coverage.functions = parseFloat(match[1]);
            }
        }
        if (line.includes('% Branches')) {
            const match = line.match(/(\d+(\.\d+)?)% Branches/);
            if (match) {
                coverage.branches = parseFloat(match[1]);
            }
        }
        if (line.includes('% Statements')) {
            const match = line.match(/(\d+(\.\d+)?)% Statements/);
            if (match) {
                coverage.statements = parseFloat(match[1]);
            }
        }
    }

    return coverage;
}

// Check if coverage meets thresholds
function checkCoverageThresholds(coverage) {
    const results = {};
    let allPassed = true;

    for (const [metric, threshold] of Object.entries(thresholds)) {
        const value = coverage[metric] || 0;
        const passed = value >= threshold;
        results[metric] = { value, threshold, passed };
        allPassed = allPassed && passed;
    }

    return { results, allPassed };
}

// Main function
async function main() {
    console.log(colors.bold + colors.blue + '\nud83dudcca TEST COVERAGE CHECK' + colors.reset);

    console.log('Running tests with coverage...');
    const testResult = runTestsWithCoverage();

    if (!testResult.success) {
        console.log(colors.red + '\nu2717 Tests failed:' + colors.reset);
        console.log(testResult.output);
        process.exit(1);
    }

    console.log(colors.green + '\nu2713 Tests passed.' + colors.reset);

    // Parse coverage from output
    const coverage = parseCoverage(testResult.output);

    // Check if coverage meets thresholds
    const { results, allPassed } = checkCoverageThresholds(coverage);

    // Display results
    console.log('\nCoverage Results:');
    console.log(colors.blue + '  ' + 'u2500'.repeat(50) + colors.reset);

    for (const [metric, result] of Object.entries(results)) {
        const icon = result.passed ? 'u2713' : 'u2717';
        const color = result.passed ? colors.green : colors.red;
        console.log(
            `  ${color}${icon}${colors.reset} ${metric.padEnd(12)} ${result.value.toFixed(2)}% / ${result.threshold}%`
        );
    }

    // Summary
    console.log(
        '\n' +
            colors.bold +
            (allPassed ? colors.green : colors.red) +
            `Coverage check ${allPassed ? 'PASSED' : 'FAILED'}` +
            colors.reset
    );

    if (!allPassed) {
        console.log('\nFailed thresholds:');
        for (const [metric, result] of Object.entries(results)) {
            if (!result.passed) {
                console.log(
                    `${colors.red}u2717${colors.reset} ${metric}: ${result.value.toFixed(2)}% (threshold: ${result.threshold}%)`
                );
            }
        }
        process.exit(1);
    }

    return allPassed;
}

// Run the main function
main().catch(error => {
    console.error(colors.red + '\nu274c Error running coverage check:' + colors.reset);
    console.error(error);
    process.exit(1);
});
