#!/usr/bin/env node

/**
 * Deployment Verification Script
 *
 * This script automates the verification of deployment checklist items
 * for the Triumvirate project.
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
            cwd: rootDir,
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
    console.log('\n' + colors.bold + colors.blue + '▶ ' + title + colors.reset);
    console.log(colors.blue + '  ' + '─'.repeat(78) + colors.reset);
}

// Helper function to print check results
function printResult(name, success, message = '') {
    const icon = success ? '✓' : '✗';
    const color = success ? colors.green : colors.red;
    console.log(`  ${color}${icon}${colors.reset} ${name}${message ? ': ' + message : ''}`);
    return success;
}

// Check if a file exists
function fileExists(filePath) {
    return fs.existsSync(path.resolve(rootDir, filePath));
}

// Check if a string contains another string (commented out for now but kept for future use)
/* function containsString(filePath, searchString) {
  try {
    const content = fs.readFileSync(path.resolve(rootDir, filePath), 'utf8');
    return content.includes(searchString);
  } catch (_) {
    return false;
  }
} */

// Main verification function
async function verifyDeployment() {
    console.log(
        colors.bold + colors.magenta + '\n📋 TRIUMVIRATE DEPLOYMENT VERIFICATION' + colors.reset
    );
    console.log(colors.magenta + '  Running checks from deployment_checklist.md' + colors.reset);

    let allPassed = true;
    let results = {};

    // Code Quality and Standards
    printSection('Code Quality and Standards');

    // Linting
    const lintResult = runCommand('npm run lint -- --max-warnings=0', { silent: true });
    results.lint = printResult('Linting checks', lintResult.success);
    allPassed = allPassed && results.lint;

    // Formatting
    const formatResult = runCommand('npm run format:check', { silent: true });
    results.format = printResult('Code formatting', formatResult.success);
    allPassed = allPassed && results.format;

    // TypeScript
    const typeCheckResult = runCommand('npm run type-check', { silent: true });
    results.typeCheck = printResult('TypeScript type checking', typeCheckResult.success);
    allPassed = allPassed && results.typeCheck;

    // Testing
    printSection('Testing');

    // Unit tests
    const testResult = runCommand('npm run test', { silent: true });
    results.unitTests = printResult(
        'Unit tests',
        testResult.success,
        testResult.success ? '' : 'Some tests failed'
    );
    allPassed = allPassed && results.unitTests;

    // Test coverage
    const coverageThreshold = 70;
    const coverageResult = runCommand('npm run test:coverage', { silent: true });
    // This is a simplified check - you might need to parse the coverage output
    results.coverage = printResult(
        'Test coverage meets threshold',
        coverageResult.success && coverageResult.output.includes(`${coverageThreshold}%`),
        `Expected >${coverageThreshold}%`
    );
    allPassed = allPassed && results.coverage;

    // Documentation
    printSection('Documentation');

    // README.md exists
    results.readme = printResult('README.md exists', fileExists('README.md'));
    allPassed = allPassed && results.readme;

    // CLI help text
    const helpTextResult = runCommand('node dist/triumvirate.js --help', { silent: true });
    results.helpText = printResult('CLI help text is available', helpTextResult.success);
    allPassed = allPassed && results.helpText;

    // Functionality
    printSection('Functionality');

    // Check if all CLI commands are defined
    const commands = ['review', 'summarize', 'plan', 'next'];
    let allCommandsDefined = true;

    for (const cmd of commands) {
        const cmdHelpResult = runCommand(`node dist/triumvirate.js ${cmd} --help`, {
            silent: true,
        });
        const cmdDefined = printResult(`'tri ${cmd}' command is defined`, cmdHelpResult.success);
        allCommandsDefined = allCommandsDefined && cmdDefined;
    }

    results.commands = allCommandsDefined;
    allPassed = allPassed && results.commands;

    // Security
    printSection('Security');

    // npm audit
    const auditResult = runCommand('npm audit --production', { silent: true });
    // npm audit returns non-zero if vulnerabilities are found
    results.audit = printResult(
        'No known vulnerabilities',
        auditResult.success || auditResult.output.includes('found 0 vulnerabilities')
    );
    allPassed = allPassed && results.audit;

    // Release Preparation
    printSection('Release Preparation');

    // package.json version
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
    results.version = printResult(
        'Version number in package.json',
        packageJson.version && packageJson.version.match(/^\d+\.\d+\.\d+$/),
        packageJson.version
    );
    allPassed = allPassed && results.version;

    // CHANGELOG.md exists
    results.changelog = printResult('CHANGELOG.md exists', fileExists('CHANGELOG.md'));
    allPassed = allPassed && results.changelog;

    // Summary
    printSection('Summary');

    console.log(
        colors.bold +
            (allPassed ? colors.green : colors.red) +
            `  Deployment verification ${allPassed ? 'PASSED' : 'FAILED'}` +
            colors.reset
    );

    if (!allPassed) {
        console.log('\n  Failed checks:');
        for (const [check, passed] of Object.entries(results)) {
            if (!passed) {
                console.log(`  ${colors.red}✗${colors.reset} ${check}`);
            }
        }
        process.exit(1);
    }

    return allPassed;
}

// Run the verification
verifyDeployment().catch(error => {
    console.error(colors.red + '\n❌ Error running deployment verification:' + colors.reset);
    console.error(error);
    process.exit(1);
});
