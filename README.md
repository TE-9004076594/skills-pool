# skills-pool

AI agent skills collection. Contains OpenSpec workflow skills (propose, design, implement, verify, archive), OPSX slash commands, and Android debugging/diagnostics skills.

## Prerequisites

### Node.js

OpenSpec CLI requires **Node.js >= 20.19.0**. Install or upgrade:

```bash
node --version        # check current version
```

- **macOS**: `brew install node`
- **Other**: download from [nodejs.org](https://nodejs.org/)

### OpenSpec CLI

```bash
npm install -g @fission-ai/openspec@latest
openspec --version    # verify installation
```

### CodeGraph CLI

CodeGraph builds a pre-indexed knowledge graph of your codebase for faster agent context retrieval.

**Option 1 — Install script (no Node.js required):**

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

**Option 2 — npm (if Node.js already installed):**

```bash
npm i -g @colbymchenry/codegraph
```

**Verify and configure:**

```bash
codegraph --version
codegraph install     # auto-detect and wire up AI agents
```

### Project Initialization

After installing OpenSpec CLI, initialize it in your project:

```bash
cd your-project
openspec init --tools claude,cursor
```

## Installing Skills

### npx skills (recommended for Cursor, Claude Code, Codex, Windsurf, Copilot)

Install all skills at once (recommended):

```bash
npx skills add https://github.com/TE-9004076594/skills-pool --all
```

Or install to a specific agent only:

```bash
npx skills add https://github.com/TE-9004076594/skills-pool -s '*' -a claude-code
```

Omitting `--all` enters interactive mode where you can toggle individual skills:

```bash
npx skills add https://github.com/TE-9004076594/skills-pool
```

### Claude Code

In Claude Code, use the plugin marketplace:
```
/plugin marketplace add TE-9004076594/skills-pool
```

### Cursor

Settings → Rules → Add Rule → Remote Rule (GitHub) and use `TE-9004076594/skills-pool`.

## Updating Skills

When skills in this repo are updated (after `git push`), installed users can upgrade:

```bash
# Update all installed skills
npx skills update

# Update global or project-level only
npx skills update -g     # global
npx skills update -p     # project-level only
```

To update CodeGraph index after code changes:

```bash
codegraph sync -q
```

## Structure

```
skills-pool/
README.md
LICENSE
AGENTS.md              # Guidance for AI agents editing this repo
.github/
  copilot-instructions.md
.claude-plugin/        # Claude Code plugin config (discovers ai-coding skills)
  plugin.json
  marketplace.json
.cursor-plugin/        # Cursor plugin config (discovers ai-coding skills)
  plugin.json
  marketplace.json
assets/
  logo.svg

ai-coding/             # The installable skill package
  commands/opsx/       # OpenSpec slash command definitions
    apply.md
    archive.md
    explore.md
    propose.md
    sync.md
    verify.md
    android-bug.md

  skills/
    llms.txt           # Skill index for agents (names, summaries, triggers)

    # OpenSpec Workflow Skills
    openspec-propose/
    openspec-apply-change/
    openspec-explore/
    openspec-archive-change/
    openspec-sync-specs/

    # OPSX Slash-Command Skills (thin wrappers around commands/opsx/)
    opsx-propose/
    opsx-apply/
    opsx-explore/
    opsx-verify/
    opsx-sync/
    opsx-archive/
    opsx-android-bug/

    # Android Debugging Skills
    android-crash-analyzer/
    android-anr-investigator/
    android-lifecycle-debugger/
    android-memory-leak-fixer/
    android-network-bug-debugger/
    android-ui-regression-checker/
```

## Skills

### OpenSpec Workflow Skills

| Skill | Description |
|-------|-------------|
| openspec-propose | Create a new change with proposal, design, and task artifacts using OpenSpec CLI |
| openspec-apply-change | Implement tasks from an OpenSpec change |
| openspec-explore | Explore mode for thinking through ideas and investigating problems |
| openspec-archive-change | Archive a completed change |
| openspec-sync-specs | Sync delta specs from a change to main specs |

### OPSX Slash Commands

| Command | Description |
|---------|-------------|
| `/opsx:propose` | Propose a new change |
| `/opsx:apply` | Implement tasks from a change |
| `/opsx:explore` | Enter explore mode |
| `/opsx:verify` | Run tests and checks |
| `/opsx:sync` | Sync delta specs |
| `/opsx:archive` | Archive a completed change |
| `/opsx:android-bug` | Investigate Android bugs with OpenSpec |

### Android Debugging Skills

| Skill | Description |
|-------|-------------|
| android-crash-analyzer | Analyze Android crash logs and find root cause |
| android-anr-investigator | Investigate ANRs and UI stalls |
| android-lifecycle-debugger | Debug lifecycle-related bugs |
| android-memory-leak-fixer | Analyze memory leaks and retention paths |
| android-network-bug-debugger | Debug network-related bugs |
| android-ui-regression-checker | Investigate UI defects and regressions |

## License

MIT
