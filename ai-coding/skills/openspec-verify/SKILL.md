---
name: openspec-verify
description: Verify an OpenSpec change by running tests, linting, and code quality checks. Use when the user wants to validate that implemented changes compile, pass tests, and meet quality standards.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---

Verify an Android change by running the Gradle build, static analysis, and unit tests against the implemented code.

Use this after implementation to validate that the changes compile, pass tests, and meet quality standards. Can also be run at any point during implementation to check progress.

**Target project type: Android (Gradle).** All verification uses the project's Gradle wrapper (`./gradlew`). Instrumented (on-device) tests are out of scope by default and only suggested at the end.

---

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

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
      - Which Gradle modules were modified (e.g., `:app`, `:feature:login`, `:core:network`)
      - Which unit test source sets are likely affected (`src/test/...`)
      - What integration points need validation

   **CodeGraph scope note**: CodeGraph indexes Kotlin/Java symbols and call paths well but may miss XML layouts, AndroidManifest.xml, Gradle scripts, and resource files. When verification involves these artifacts, supplement CodeGraph with:
   - `rg` (ripgrep) for XML/resource/manifest files
   - `./gradlew :module:dependencies` for dependency resolution
   - Direct file inspection for build configuration changes

4. **Sync CodeGraph index**

   Sync the CodeGraph index so exploration and verification operate on fresh data:
   ```bash
   codegraph sync -q
   ```
   This picks up any code changes made during implementation or manual edits.

5. **Detect the Gradle wrapper and affected modules**

   a. **Locate the wrapper**:
      - Use `./gradlew` from the project root if it exists (`gradlew.bat` on Windows).
      - If no wrapper exists, report it and fall back to `gradle` only if the user confirms it is installed.

   b. **Map CodeGraph findings to Gradle module paths** (`:module:submodule`).
      - Prefer running checks scoped to affected modules (e.g., `:feature:login:testDebugUnitTest`).
      - If the affected module cannot be determined, run project-wide tasks but warn the user they may be slow.

   c. **Detect available quality plugins** by checking build scripts (`build.gradle`/`build.gradle.kts`) or listing tasks:
      ```bash
      ./gradlew tasks --all -q 2>&1 || true
      ```
      - Note whether `ktlintCheck`, `detekt`, `spotlessCheck`, or `lint` tasks exist.
      - Only run tasks that actually exist in this project; skip (mark N/A) the ones that don't.

6. **Run verification checks**

   Run the following checks in order. Stop and report if any check fails, but let the user decide whether to continue.
   Prefer the `Debug` variant for speed. Scope to affected modules where possible (replace `:module` accordingly).

   a. **Static analysis / formatting** (only the tasks that exist in the project):
      ```bash
      ./gradlew :module:ktlintCheck 2>&1 || true      # if ktlint is configured
      ./gradlew :module:detekt 2>&1 || true            # if detekt is configured
      ./gradlew :module:spotlessCheck 2>&1 || true     # if spotless is configured
      ```
      - Report which files have style/lint issues
      - ktlint can often be auto-fixed with `./gradlew :module:ktlintFormat`; spotless with `:module:spotlessApply`

   b. **Android Lint** (catches Android-specific issues: resources, manifest, API levels):
      ```bash
      ./gradlew :module:lintDebug 2>&1 || true
      ```
      - If the module has no `lintDebug`, try `:module:lint`
      - Report errors and warnings; the HTML/XML report path is printed in the output

   c. **Compile the affected module(s)**:
      ```bash
      ./gradlew :module:assembleDebug
      ```
      - Compilation must pass before running tests. If it fails, report the compile errors and stop.

   d. **Run unit tests for affected module(s)**:
      ```bash
      ./gradlew :module:testDebugUnitTest
      ```
      - If multiple modules are affected, run for each identified module
      - **Important**: For root/shared modules or a project-wide `test`, ask the user before running since they can be slow

   e. **If all above pass and all tasks are complete**, suggest the fuller checks:
      ```bash
      ./gradlew testDebugUnitTest lintDebug        # project-wide unit tests + lint
      ```
      - **Always ask the user** before running project-wide tasks as they are time-consuming
      - **Instrumented tests** (`connectedDebugAndroidTest`) require a device/emulator and are out of scope for this skill; only suggest them as a manual follow-up when the change affects UI/integration behavior

7. **Report results**

   Show a structured verification report:

   ```
   ## Verification Report: <change-name>

   ### Checks
   - **Static analysis**: ✅ Passed (or ❌ Failed / ⏭️ N/A - ktlint/detekt/spotless)
   - **Android Lint**:    ✅ Passed (or ❌ Failed - report path listed)
   - **Compile**:         ✅ Passed (or ❌ Failed - errors below)
   - **Unit Tests**:      ✅ Passed (or ❌ Failed - summary below)

   ### Test Results (if applicable)
   <test output summary, showing passed/failed counts and report path>

   ### CodeGraph Codebase Context
   - Affected Gradle modules: <list>
   - Related test source sets: <list>

   ### Status
   - Tasks complete: N/M
   - Overall: ✅ All checks passed / ⚠️ Issues found
   ```

**Output Examples**

On success:
```
## Verification Report: add-user-auth
### Checks
- **Static analysis**: ✅ Passed (ktlint, detekt)
- **Android Lint**:    ✅ Passed
- **Compile**:         ✅ Passed (:feature:auth:assembleDebug)
- **Unit Tests**:      ✅ Passed (42 passed, 0 failed)

### Status
✅ All checks passed! Ready to archive this change.
```

On failure:
```
## Verification Report: add-user-auth
### Checks
- **Static analysis**: ✅ Passed
- **Android Lint**:    ❌ Failed
  - error: MissingPermission in AuthManager.kt:88 (ACCESS_FINE_LOCATION not requested)
- **Compile**:         ⏭️ Skipped (lint errors first)
- **Unit Tests**:      ⏭️ Skipped

### Status
⚠️ Issues found. Fix the reported problems and run verify again.
```

**Handling Long-Running Commands**

- Run each verification step as a foreground command with appropriate timeout
- Gradle daemon warm-up and configuration can be slow on first run; allow generous timeouts
- If `testDebugUnitTest` or a project-wide task takes more than 2 minutes, move it to background and continue
- For project-wide tasks, always run in background and inform the user

**Guardrails**
- Prefer module-scoped tasks (`:module:task`) over project-wide tasks for speed
- Only run quality tasks (ktlint/detekt/spotless/lint) that actually exist in the project; mark missing ones as N/A
- Always compile (`assembleDebug`) before running tests - fix compile errors first
- Only run targeted unit tests by default; ask before running project-wide or shared-module tests
- Instrumented tests (`connectedDebugAndroidTest`) are out of scope - suggest as manual follow-up only
- Report clear pass/fail for each check with the Gradle report path when available
- Never modify code during verification - this is read-only validation
- If a check fails, show the specific error and suggested fix command (e.g., `./gradlew :module:ktlintFormat`)
- CodeGraph exploration is used to identify the right Gradle modules to verify
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual code search.
