#!/usr/bin/env node

/**
 * Triumvirate CLI Entry Point
 * 
 * This is the main entry point for the Triumvirate CLI tool.
 * It runs codebase reviews across multiple LLM providers (OpenAI, Claude, and Gemini).
 */

import { run } from '@stricli/core';
import { buildContext } from '../context';
import { app } from '../app';

// Execute the CLI
await run(app, process.argv.slice(2), buildContext(process));
