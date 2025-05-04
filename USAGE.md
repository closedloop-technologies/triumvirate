# Triumvirate Usage

Here are some example workflows

*(TODO: Expand with at least 3 detailed workflows)*

## `tri review`

This runs inside an existing repo and on a branch.  Ideally the branch is clean.

This reviews the codebase and generates a report in `./.justbuild/review.json`
and `./.justbuild/review.md`

This file can be commited to the repo via `tri commit`.  This is like OCO but customizes the commit message based on the latest `tri {action}` run

## `tri next`

This takes a report file and generates a set of tasks.  It 