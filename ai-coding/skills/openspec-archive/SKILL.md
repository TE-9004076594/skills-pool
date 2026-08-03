---
name: openspec-archive
description: Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done` or other)

   If status reports `actionContext.mode: "workspace-planning"`, explain that workspace archive is not supported in this slice and STOP. Do not move workspace changes into repo-local archives or edit linked repos.

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Use **AskUserQuestion tool** to confirm user wants to proceed
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

4. **Verify build gate (fail-soft)**

   A change should not be archived on a broken branch. Before archiving:
   - Run `openspec status --change "<name>" --json` and check whether a `/opsx:verify` session completed successfully within the conversation (look for a `Verification Report` section or a `status: "done"` marker for affected modules).
   - If no verify report exists or the last report shows failures, prompt the user:
     - **"Run `/opsx:verify` first (recommended)"** - compile + lint + unit tests before archiving
     - **"Skip verify and archive anyway (record risk)"** - archive but note in the summary that verification was not completed

   This gate exists because iteration and bugfix workflows commonly skip the final check — the archive becomes the last record, and a broken branch archived this way silently contaminates future work.

5. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON to check for delta specs. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Archive without syncing"
   - If already synced: "Archive now", "Sync anyway", "Cancel"

   If user chooses sync, use Task tool (subagent_type: "general-purpose", prompt: "Use Skill tool to invoke openspec-sync-specs for change '<name>'. Delta spec analysis: <include the analyzed delta spec summary>"). Proceed to archive regardless of choice.

6. **Capture CodeGraph snapshot of affected code**

   Before archiving, use CodeGraph to capture what code was affected by this change:

   a. **Extract key terms** from the change artifacts (proposal, design) and task descriptions

   b. **Run codegraph explore** to get a final snapshot of related code:
      ```bash
      codegraph explore "<key terms>"
      ```

   c. **Include key findings in the archive summary**:
      - Main files/modules affected by the change
      - Architecture context for future reference
      - This helps anyone looking at the archive understand what code areas were involved

   > The codegraph snapshot is included in the archive summary to preserve context about what code was affected.

6b. **Trigger CodeKB knowledge feedback** (if CodeKB is initialized and `auto_extract_on_archive` is enabled)

   Archiving means the change is complete and verified — this is the ideal moment to distill new knowledge:

   ```bash
   # Check CodeKB status
   codekb status

   # Extract knowledge from the archived change (proposal, spec-delta, archive, affected code)
   codekb extract --from-change "<name>"
   ```

   The extraction:
   - Reads `proposal.md` / `design.md` / `spec-delta.md` / `archive.md` for new design decisions and rules
   - Sets `source_change: <name>` on new entries for traceability
   - Detects superseded decisions — if the change overturns an old decision, the old entry's status becomes `superseded` and links to the new one
   - Validates `codekb:ref` references still hold after the change

   **If CodeKB is not initialized**, skip this step (the change can still be archived normally).

7. **Generate PR summary and optionally create PR**

   Archive is the final record of a change. Generate a pull-request-ready summary from the OpenSpec artifacts:

   a. **Collect change metadata**:
      - Read `proposal.md` for the motivation and scope
      - Read `design.md` for technical decisions
      - Read `tasks.md` for what was implemented
      - Run `git log --oneline main..HEAD` (or the base branch) to list commits on the feature branch

   b. **Generate a PR description** and write it to `<changeRoot>/PR.md`:
      ```markdown
      ## <Change Title>

      **OpenSpec change:** <change-name>
      **Schema:** <schema-name>
      **Branch:** opsx/<change-name>

      ### What
      <one-paragraph summary from proposal.md>

      ### Why
      <motivation from proposal.md>

      ### How
      <brief technical approach from design.md>

      ### Changes
      - <file>: <what changed>
      - ...

      ### Verification
      - [ ] Unit tests added / updated
      - [ ] `/opsx:verify` passed (compile + lint + tests)
      - [ ] Bug: reproduction steps no longer trigger
      - [ ] Bug: regression test added

      ### Commits
      <output of git log --oneline base..HEAD>

      ### OpenSpec Artifacts
      - proposal: <path>
      - design: <path>
      - tasks: <path>
      - Archive: <archive-location>
      ```

   c. **Optionally create the PR** if `gh` CLI is available:
      ```bash
      gh pr create --title "<change title>" --body-file <changeRoot>/PR.md --base main
      ```
      If the user declines or `gh` is unavailable, just inform them the PR description is at `<changeRoot>/PR.md`.

8. **Perform the archive**

   Create an `archive` directory under `planningHome.changesDir` if it doesn't exist:
   ```bash
   mkdir -p "<planningHome.changesDir>/archive"
   ```

   Generate target name using current date: `YYYY-MM-DD-<change-name>`

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Move `changeRoot` to the archive directory

   ```bash
   mv "<changeRoot>" "<planningHome.changesDir>/archive/YYYY-MM-DD-<name>"
   ```

9. **Display summary with CodeGraph context**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - **CodeGraph affected area** (key files/modules discovered)
   - Spec sync status (synced / sync skipped / no delta specs)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs" or "Sync skipped")
**Affected CodeArea:** <key files/modules from CodeGraph>

All artifacts complete. All tasks complete.
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- If sync is requested, use openspec-sync-specs approach (agent-driven)
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual code search.
