# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- JavaScript files use lowercase with hyphens or camelCase: `index.js`, `exec.js`
- Compiled distribution files: `dist/index.js`

**Functions:**
- camelCase naming convention: `main()`, `updateReadme()`, `buildReadme()`, `commitReadme()`
- Async functions declared with `async` keyword: `async function updateReadme(data)`
- Anonymous arrow functions for entry point: `(async () => { await main(); })()`

**Variables:**
- camelCase for local variables: `karma`, `completed_count`, `karmaPoint`, `readmeData`
- SCREAMING_SNAKE_CASE for constants: `TODOIST_API_KEY`, `PREMIUM`, `README_FILE_PATH`
- Global state variables: `todoist`, `jobFailFlag`

**Types:**
- No TypeScript used; all JavaScript with implicit typing
- Objects destructured for readability: `const { karma, completed_count, days_items, goals, week_items } = data;`

## Code Style

**Formatting:**
- No linter configured (no .eslintrc, .prettierrc, or similar files present)
- Indentation: 2 spaces (observed in source code)
- Quote style: Double quotes preferred for strings and template literals not used for string interpolation
- Semicolons: Present on statements

**Linting:**
- No automated linting tool configured
- Manual code review expected

## Import Organization

**Order:**
1. External dependencies: `const core = require("@actions/core");`
2. Utility libraries: `const axios = require("axios");`, `const Humanize = require("humanize-plus");`
3. Built-in modules: `const fs = require("fs");`, `const {spawn} = require('child_process');`
4. Local modules: `const exec = require("./exec");`

**Path Aliases:**
- Not used; relative paths for local modules: `require("./exec")`

## Error Handling

**Patterns:**
- Process exit on fatal errors: `process.exit(1)` on missing README tags
- Error logging via `core.error()` from @actions/core
- Promise rejection handling in `exec.js`: errors captured and rejected with custom error objects
- Job failure flag propagation: `jobFailFlag` global variable checked and passed to process.exit()
- Conditional error handling: `if (code !== 0)` in spawn callback

Example from `exec.js`:
```javascript
app.on('close', (code) => {
  if (code !== 0) {
    const err = new Error(`Invalid status code: ${code}`);
    err.code = code;
    return reject(err);
  }
  return resolve(code);
});
```

## Logging

**Framework:** `console.log()` and `core.info()` from @actions/core

**Patterns:**
- Command execution logging: `console.log(`Started: ${cmd} ${args.join(' ')}`);` in `exec.js`
- Info messages via GitHub Actions: `core.info("Writing to " + README_FILE_PATH);`
- Error messages via GitHub Actions: `core.error(...);`
- No dedicated logger; mixing console.log and core methods

## Comments

**When to Comment:**
- Commented-out code visible in source (lines 55-57 in `index.js` show old implementation)
- Comments indicating version changes: `// v8 => v9` on line 11 of `index.js`
- No JSDoc/TypeDoc documentation present

**JSDoc/TSDoc:**
- Not used; no function documentation strings observed

## Function Design

**Size:**
- Small to medium functions: `buildReadme()` is ~30 lines, `updateReadme()` is ~50 lines
- Main logic concentrated in `index.js`

**Parameters:**
- Functions accept explicit parameters: `buildReadme(prevReadmeContent, newReadmeContent)`
- Destructuring used for object parameters: `const { karma, completed_count, days_items, goals, week_items } = data;`

**Return Values:**
- Implicit returns in async functions via await
- Promise-based returns: `exec()` returns Promise
- Early returns for conditional logic: `if (todoist.length == 0) return;`

## Module Design

**Exports:**
- Single default export: `module.exports = exec;` in `exec.js`
- Main entry point: `index.js` with IIFE pattern: `(async () => { await main(); })()`

**Barrel Files:**
- Not used; single entry point only

---

*Convention analysis: 2026-02-11*
