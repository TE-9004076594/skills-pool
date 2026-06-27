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
