---
name: android-ui-regression-checker
description: Investigate Android UI defects and regression risks across Views and Jetpack Compose, including layout issues, click handling, rendering glitches, list instability, and visual consistency.
license: MIT
compatibility: Works with any Android project. Use alongside openspec workflow skills for structured bug investigation.
metadata:
  author: ai-coding
  version: "1.0"
---

# Android UI Regression Checker

## Purpose
Use this skill for:
- layout breakage
- overlapping/truncated UI
- click targets not working
- dark mode defects
- screen adaptation issues
- RecyclerView flicker
- Compose recomposition or state rendering issues
- visual regressions after refactor

## Goals
- identify whether the bug is layout, state, rendering, adapter, or interaction related
- find the narrowest UI change needed
- assess regression risk across screen sizes, themes, and locales
- recommend validation and screenshot/UI tests

## Inputs
Useful inputs:
- screenshots or screen recordings
- affected screen code
- XML or Compose code
- adapter/list item code
- theme/style resources
- reproduction steps
- device size, density, locale, font scale, dark mode info

## Workflow

### 1. Classify UI bug
Determine whether the issue is mainly:
- layout constraint issue
- wrong visibility/state rendering
- click/intercept/focus issue
- list item reuse/binding issue
- animation/transition glitch
- Compose state/recomposition issue
- theme/style issue
- inset/system bar issue
- localization/font-scale issue

### 2. Inspect rendering path
Review:
- screen/container layout
- item layout
- visibility and enabled state logic
- adapter binding or Compose state source
- click listener registration
- padding/margin/constraints/insets
- stable IDs, diffing, and item identity
- theme overlays and text appearance

### 3. Check device-specific factors
Consider:
- small screen
- large font
- RTL
- dark mode
- landscape
- foldables/tablets
- OS version differences
- gesture nav/system insets

### 4. Recommend fix
Prefer:
- fixing constraints/state source directly
- avoiding hard-coded dimensions where adaptive rules are needed
- stabilizing item identity
- making click handlers lifecycle/state safe
- using preview/screenshot tests for high-risk screens

Avoid:
- patching with arbitrary margins
- invalidating whole list unnecessarily
- storing duplicated UI state in multiple places
- mixing interaction state and render state ambiguously

### 5. Validation
Always include:
- affected devices/sizes
- dark mode
- large font
- RTL if text/layout relevant
- repeated scroll/rebind checks
- loading/error/content state transitions

## Output Format
1. **UI Bug Summary**
2. **Failure Mode**
3. **Suspect UI Layers / Files**
4. **Recommended Fix**
5. **Regression Risk Assessment**
6. **Validation Matrix**
7. **Tests To Add**

## Good Fix Patterns
- use proper constraints or adaptive Compose modifiers
- ensure single source of truth for UI state
- use stable IDs / correct diff callbacks
- separate loading/error/content rendering
- verify touch target and click interception
- add screenshot or UI tests for fragile layouts

## Anti-Patterns
- magic pixel offsets
- duplicate state across adapter/viewmodel/view
- full-list refresh when targeted update is enough
- recomposition-trigger loops from unstable state

## CodeGraph Integration

CodeGraph helps identify the rendering path, state sources, and view binding code.

**When to run CodeGraph**:
- During step 2 (inspect rendering path) — explore the Composable function, View binding, or adapter code
- During step 3 (check device-specific factors) — find resource qualifier usage, theme references
- During step 4 (recommend fix) — understand the full data-to-render pipeline

```bash
codegraph explore "<Composable, View class, or adapter>"
```

**What to look for from CodeGraph results**:
- **State-to-UI mapping**: ViewModel state collectors, `collectAsState`, adapter data sets
- **Compose stability**: `@Stable`/`@Immutable` annotations, lambda stability in composable params
- **Recomposition boundaries**: `remember`, `derivedStateOf`, `snapshotFlow` usage
- **Adapter binding**: `onBindViewHolder`, `DiffUtil`, `ListAdapter` submission logic
- **Layout inflation**: `onCreateView`, `onCreateDialog`, custom `LayoutInflater` usage
- **Resource references**: theme attributes, dimension resources, color state lists used by the view
- **Click/interaction handlers**: `setOnClickListener`, `Modifier.clickable`, touch delegation

**Scope note**: CodeGraph does not reliably index `res/layout/*.xml`, `res/values/*.xml`, `res/drawable/*.xml`, or AndroidManifest.xml (theme declarations, config changes). For UI bugs rooted in layout XML, theme inheritance, or resource qualifiers, supplement with `rg`/`find` on the `res/` directory.

**Fallback**: If `codegraph explore` returns no meaningful results, proceed without it — CodeGraph is an enhancement, not a blocker. Fall back to `rg`/grep for manual UI code search.
