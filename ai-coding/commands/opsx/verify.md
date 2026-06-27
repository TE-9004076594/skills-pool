---
name: OPSX: Verify
description: Verify an OpenSpec change by running tests, linting, and code quality checks
category: Workflow
tags: [workflow, verify, test, experimental]
---

Verify a change by running tests, linting, and code quality checks against the implemented code.

Use this after `/opsx:apply` to validate that the changes compile, pass tests, and meet quality standards. Can also be run at any point during implementation to check progress.

---

**Input**: Optionally specify a change name (e.g., `/opsx:verify add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>".

2. **Check status and read artifacts**

   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: list of artifacts with their status

   Read the tasks file to understand what was implemented. Also read proposal/design for context on what areas were affected.

3. **Explore codebase with CodeGraph**

   Use CodeGraph to understand what code areas the change affects:

   a. **Extract key technical terms** from task descriptions and design artifacts

   b. **Run codegraph explore** to gather relevant code context:
      ```bash
      codegraph explore "<key terms>"
      ```

   c. **Identify verification targets** from the results:
      - Which crates/packages/modules were modified
      - Which test files are likely affected
      - What integration points need validation

4. **Sync CodeGraph index**

   Sync the CodeGraph index so exploration and verification operate on fresh data:
   ```bash
   codegraph sync -q
   ```
   This picks up any code changes made by `/opsx:apply` or manual edits.

5. **Run verification checks**

   Run the following checks in order. Stop and report if any check fails, but let the user decide whether to continue.

   a. **Formatting check**:
      ```bash
      just fmt-check
      ```
      - If this fails, report which files have formatting issues
      - Can be auto-fixed with `just fmt`

   b. **Clippy / Rust linting** (if Rust code was changed):
      Determine the specific packages affected from CodeGraph findings:
      ```bash
      cd codex-rs && cargo clippy --tests -p <affected-package> 2>&1 || true
      ```
      - If no specific package identified, run a focused clippy check
      - Report any warnings or errors

   c. **Run tests for affected packages**:
      Based on CodeGraph findings, identify the most relevant test target:
      ```bash
      cd codex-rs && just test -p <affected-package>
      ```
      - If multiple packages affected, run for each identified package
      - **Important**: For `codex-core` or large shared crates, ask the user before running full tests since they can be slow

   d. **Run argument-comment lint** (if Rust code was changed):
      ```bash
      just argument-comment-lint 2>&1 || true
      ```

   e. **If all above pass and all tasks are complete**, suggest running full test suite:
      ```bash
      cd codex-rs && just test
      ```
      - **Always ask the user** before running the full test suite as it's time-consuming

6. **Report results**

   Show a structured verification report:

   ```
   ## Verification Report: <change-name>

   ### Checks
   - **Formatting**: ✅ Passed (or ❌ Failed - run `just fmt`)
   - **Clippy**:      ✅ Passed (or ❌ Failed - warnings/errors listed)
   - **Tests**:       ✅ Passed (or ❌ Failed - summary below)
   - **Arg Comment**: ✅ Passed (or ❌ Skipped / N/A)

   ### Test Results (if applicable)
   <test output summary, showing passed/failed counts>

   ### CodeGraph Codebase Context
   - Affected packages/modules: <list>
   - Related test files: <list>

   ### Status
   - Tasks complete: N/M
   - Overall: ✅ All checks passed / ⚠️ Issues found
   ```

**Output Examples**

On success:
```
## Verification Report: add-user-auth
### Checks
- **Formatting**: ✅ Passed
- **Clippy**:      ✅ Passed
- **Tests**:       ✅ Passed (42 passed, 0 failed)
- **Arg Comment**: ✅ Passed

### Status
✅ All checks passed! Ready for `/opsx:archive`.
```

On failure:
```
## Verification Report: add-user-auth
### Checks
- **Formatting**: ✅ Passed
- **Clippy**:      ❌ Failed
  - warning: unused import `std::collections::HashMap` in src/auth.rs:12
- **Tests**:       ⏭️ Skipped (clippy must pass first)

### Status
⚠️ Issues found. Fix the reported problems and run `/opsx:verify` again.
```

**Handling Long-Running Commands**

- Run each verification step as a foreground command with appropriate timeout
- If `just test` takes more than 2 minutes, move it to background and continue
- For the full test suite, always run in background and inform the user

**Guardrails**
- Always run formatting check first - it's fast and catches obvious issues
- Do not run tests if compilation/clippy fails - fix compile errors first
- Only run targeted tests by default; ask before running full test suite
- Report clear pass/fail for each check
- Never modify code during verification - this is read-only validation
- If a check fails, show the specific error and suggested fix command
- CodeGraph exploration is used to identify the right verification scope
