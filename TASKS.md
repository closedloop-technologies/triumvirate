# Triumvirate Task

This is a design document for the `tri next` command

This command should take an output file of `tri review` and perform the following actions

## Overview

Develop an automated system to transform code review reports into actionable sprint tickets with dependency tracking. The tool should analyze code review findings, generate comprehensive work tickets, and visualize task dependencies for optimal sprint planning.

## Background

Engineering teams struggle to efficiently convert code review findings into structured work items. This often results in important fixes being overlooked or improperly prioritized. A systematic approach is needed to ensure all code quality issues are addressed methodically.

## Requirements

### 1. Code Review Analysis `tri review`

- Parse standardized code review reports
- Identify distinct issues that require attention
- Categorize issues by type (bug, enhancement, technical debt, etc.)
- Automatically assign priority levels based on severity and impact

### 2. Ticket Generation (parallel)

First look at the code review analysis and make an initial decomposition of tasks

Prompt:

> Here's a code review report of my code base.  Please determine the number of issue tracking I can make for this week's sprint.  Take each of the list of problems mentioned and determine which ones can be worked on separately by different team members.

This returns a list of tasks

Then parallel call the Proposal (list of tasks and the final selected list to generate a full ticket)

- Create comprehensive tickets following a standardized schema
- Include essential fields:
  - Title and unique identifier
  - Type and priority classification
  - Detailed description with context
  - Implementation guidance with code examples
  - Affected components/files
  - Acceptance criteria
  - Estimated effort
  - Git commit message prefix template - and git branch name

### 3. Dependency Analysis

Then take the full list of tickets and generate DAG to better understand dependencies

- Identify dependencies between tickets
- Generate a directed acyclic graph (DAG) visualization of dependencies
- Flag critical paths and bottlenecks
- Provide optimal sequencing recommendations

Save this as `.justbuild/tasks.json` with the encoded tickets and dependencies
Store it in a Graph structure

### 4. Integration Options

- Support export to common ticketing systems (JIRA, GitHub, GitLab, Linear)
- Provide API for custom integration workflows
- Include command-line interface for batch processing

## Success Criteria

- Successfully analyze a complex code review report and identify 90%+ of actionable issues
- Generate well-structured tickets that follow industry best practices
- Accurately identify dependencies between tickets
- Provide clear visual representation of task dependencies
- Enable efficient import to at least 3 popular ticketing systems

## Contributor Guidelines

### Dependency Management

- **Package Lock File**: Always commit the `package-lock.json` file to version control. This ensures:
  - Consistent dependency installations across all environments
  - Reproducible builds for all developers and CI systems
  - Security by preventing automatic upgrades to potentially vulnerable packages
  - Prevention of "works on my machine" issues caused by different dependency versions

- When adding or updating dependencies:
  - Use exact version numbers when possible (`npm install --save-exact <package>`)
  - Always review the changes to `package-lock.json` before committing
  - Document significant dependency changes in commit messages
