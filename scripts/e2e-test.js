#!/usr/bin/env node

/**
 * End-to-End Test Script
 *
 * This script tests the Triumvirate CLI commands in a real-world scenario.
 */

import { execSync } from 'child_process';
import fs from 'fs';
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

// Helper function to run a command and return its output
function runCommand(command, options = {}) {
    try {
        const output = execSync(command, {
            cwd: options.cwd || rootDir,
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options,
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

// Helper function to print section headers
function printSection(title) {
    console.log('\n' + colors.bold + colors.blue + '\u25b6 ' + title + colors.reset);
    console.log(colors.blue + '  ' + '\u2500'.repeat(78) + colors.reset);
}

// Helper function to print check results
function printResult(name, success, message = '') {
    const icon = success ? '\u2713' : '\u2717';
    const color = success ? colors.green : colors.red;
    console.log(`  ${color}${icon}${colors.reset} ${name}${message ? ': ' + message : ''}`);
    return success;
}

// Create a temporary test directory
function createTestDir() {
    const testDir = path.resolve(rootDir, 'e2e-test-temp');
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Create a simple test file
    const testFilePath = path.resolve(testDir, 'test-file.js');
    fs.writeFileSync(
        testFilePath,
        `
// This is a test file for Triumvirate E2E testing
function greet(name) {
  return 'Hello, ' + name + '!';
}

// TODO: Add more functionality
const result = greet('World');
console.log(result);
  `
    );

    return testDir;
}

// Clean up the test directory
function cleanupTestDir(testDir) {
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
}

// Main function to run E2E tests
async function runE2ETests() {
    console.log(
        colors.bold + colors.magenta + '\n\ud83d\udcbb TRIUMVIRATE E2E TESTS' + colors.reset
    );

    let allPassed = true;
    const results = {};
    const testDir = createTestDir();

    try {
        printSection('Setup');

        // Check if Triumvirate CLI is built
        const buildResult = runCommand('npm run build', { silent: true });
        results.build = printResult('Build Triumvirate CLI', buildResult.success);
        allPassed = allPassed && results.build;

        if (!results.build) {
            throw new Error('Failed to build Triumvirate CLI');
        }

        // Test CLI commands
        printSection('CLI Commands');

        // Test --help
        const helpResult = runCommand('node dist/triumvirate.js --help', { silent: true });
        results.help = printResult(
            '--help command',
            helpResult.success && helpResult.output.includes('Usage: triumvirate')
        );
        allPassed = allPassed && results.help;

        // Test version
        const versionResult = runCommand('node dist/triumvirate.js --version', { silent: true });
        results.version = printResult(
            '--version command',
            versionResult.success && versionResult.output.match(/\d+\.\d+\.\d+/)
        );
        allPassed = allPassed && results.version;

        // Test review command help
        const reviewHelpResult = runCommand('node dist/triumvirate.js review --help', {
            silent: true,
        });
        results.reviewHelp = printResult(
            'review --help command',
            reviewHelpResult.success && reviewHelpResult.output.includes('Run a code review')
        );
        allPassed = allPassed && results.reviewHelp;

        // Test next command help
        const nextHelpResult = runCommand('node dist/triumvirate.js next --help', { silent: true });
        results.nextHelp = printResult(
            'next --help command',
            nextHelpResult.success && nextHelpResult.output.includes('Read the plan and emit')
        );
        allPassed = allPassed && results.nextHelp;

        // Test plan command help
        const planHelpResult = runCommand('node dist/triumvirate.js plan --help', { silent: true });
        results.planHelp = printResult(
            'plan --help command',
            planHelpResult.success && planHelpResult.output.includes('Decompose a review summary')
        );
        allPassed = allPassed && results.planHelp;

        // Test summarize command help
        const summarizeHelpResult = runCommand('node dist/triumvirate.js summarize --help', {
            silent: true,
        });
        results.summarizeHelp = printResult(
            'summarize --help command',
            summarizeHelpResult.success && summarizeHelpResult.output.includes('Generate a summary')
        );
        allPassed = allPassed && results.summarizeHelp;

        // Test CLI options
        printSection('CLI Options');

        // Test --output-dir option
        const outputDirResult = runCommand(
            'node dist/triumvirate.js --output-dir ./custom-output --help',
            { silent: true }
        );
        results.outputDir = printResult(
            '--output-dir option',
            outputDirResult.success && !outputDirResult.output.includes('error')
        );
        allPassed = allPassed && results.outputDir;

        // Test --agent-model option
        const agentModelResult = runCommand(
            'node dist/triumvirate.js --agent-model openai --help',
            { silent: true }
        );
        results.agentModel = printResult(
            '--agent-model option',
            agentModelResult.success && !agentModelResult.output.includes('error')
        );
        allPassed = allPassed && results.agentModel;

        // Test --pass-threshold option
        const passThresholdResult = runCommand(
            'node dist/triumvirate.js --pass-threshold strict --help',
            { silent: true }
        );
        results.passThreshold = printResult(
            '--pass-threshold option',
            passThresholdResult.success && !passThresholdResult.output.includes('error')
        );
        allPassed = allPassed && results.passThreshold;

        // Test next command options
        printSection('Next Command Options');

        // Test next --branch option
        const nextBranchResult = runCommand('node dist/triumvirate.js next --help', {
            silent: true,
        });
        results.nextBranch = printResult(
            'next --branch option',
            nextBranchResult.success && nextBranchResult.output.includes('--branch')
        );
        allPassed = allPassed && results.nextBranch;

        // Test next --mark-complete option
        results.nextMarkComplete = printResult(
            'next --mark-complete option',
            nextBranchResult.success && nextBranchResult.output.includes('--mark-complete')
        );
        allPassed = allPassed && results.nextMarkComplete;
    } catch (error) {
        console.error(colors.red + '\n\u274c Error during E2E tests:' + colors.reset);
        console.error(error);
        allPassed = false;
    } finally {
        // Clean up
        cleanupTestDir(testDir);
    }

    // Summary
    printSection('Summary');

    console.log(
        colors.bold +
            (allPassed ? colors.green : colors.red) +
            `  E2E tests ${allPassed ? 'PASSED' : 'FAILED'}` +
            colors.reset
    );

    if (!allPassed) {
        console.log('\n  Failed checks:');
        for (const [check, passed] of Object.entries(results)) {
            if (!passed) {
                console.log(`  ${colors.red}\u2717${colors.reset} ${check}`);
            }
        }
        process.exit(1);
    }

    return allPassed;
}

// Run the E2E tests
runE2ETests().catch(error => {
    console.error(colors.red + '\n\u274c Error running E2E tests:' + colors.reset);
    console.error(error);
    process.exit(1);
});
