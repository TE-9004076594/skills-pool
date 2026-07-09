# Guidance for AI Agents Working in This Repo

This repository contains **AI coding skills** for AI coding agents. When editing or adding skills, follow these rules.

## Repo structure

- **ai-coding/skills/** — Each subdirectory is one skill. The CLI and agents discover skills by scanning `ai-coding/skills/` for directories that contain `SKILL.md`.
- **Skill directory name** must exactly match the `name` in that skill's frontmatter (e.g. `ai-coding/skills/openspec-propose/` ↔ `name: openspec-propose`).
- **ai-coding/commands/opsx/** — OpenSpec slash command definitions referenced by the opsx-* skills.
- **Skills** are grouped into categories:
  - `openspec-*` — OpenSpec structured change management workflow (propose, design, implement, verify, archive, sync)
  - `opsx-*` — Slash-command skills for the OpenSpec workflow (apply, explore, propose, archive, sync, verify, android-bug)
  - `android-*` — Android debugging and diagnostics (crash analyzer, ANR investigator, lifecycle debugger, memory leak fixer, network bug debugger, UI regression checker)

## SKILL.md requirements

- **Frontmatter (YAML):**
  - `name` (required): lowercase, hyphens only, max 64 chars, must match parent directory name.
  - `description` (required): what the skill does and when to use it; include trigger terms so agents know when to apply it. Max 1024 chars.
  - `license` (optional): e.g. `MIT` if the skill is under the repo license.
  - `compatibility` (recommended for OpenSpec alignment): e.g. `Works with openspec workflow skills.`
  - `metadata.author`, `metadata.version` (recommended for OpenSpec alignment).
- **Body:** Markdown instructions. Keep under ~500 lines.

## Conventions

- Write descriptions in **third person** (e.g. "Use when…" not "You can use when…").
- Be concise.
- When adding a new skill: create `ai-coding/skills/<skill-name>/SKILL.md`, then update `ai-coding/skills/llms.txt` and the README.

## References

- [Agent Skills specification](https://agentskills.io/specification.md)
- [skills CLI](https://github.com/vercel-labs/skills)
- [OpenSpec](https://openspec.dev)
