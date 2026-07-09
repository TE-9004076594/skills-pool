# ai-coding

AI coding workflow skills for OpenSpec structured change management (propose, design, implement, verify, archive), OPSX slash commands, and Android debugging/diagnostics skills.

## What's Included

### OpenSpec Workflow Skills

| Skill | Description |
|-------|-------------|
| openspec-propose | Create a new change with proposal, design, and task artifacts using OpenSpec CLI |
| openspec-apply | Implement tasks from an OpenSpec change |
| openspec-explore | Explore mode for thinking through ideas and investigating problems |
| openspec-archive | Archive a completed change |
| openspec-sync-specs | Sync delta specs from a change to main specs |
| openspec-android-bug | Investigate and propose a fix for an Android bug using OpenSpec workflow |
| openspec-trace-logger | Temporary diagnostic probe — instrument call chain with structured logs |
| openspec-verify | Verify a change by running tests, linting, and code quality checks |

### OPSX Slash Commands

| Command | Description |
|---------|-------------|
| `/opsx:propose` | Propose a new change |
| `/opsx:apply` | Implement tasks from a change |
| `/opsx:explore` | Enter explore mode |
| `/opsx:verify` | Run tests and checks |
| `/opsx:trace-log` | Inject temporary trace logs for runtime diagnosis |
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
| android-camera-bugfix-skill | Diagnose and fix Android camera issues |
| android-gallery-bugfix-skill | Diagnose and fix gallery/MediaStore issues |

## Installing

### Prerequisites

Before installing ai-coding, make sure the system environment is ready. See [skills-pool Prerequisites](../README.md#prerequisites) for:

- Git
- Node.js >= 20.19.0
- OpenSpec CLI (`npm install -g @fission-ai/openspec@latest`)
- CodeGraph CLI
- Platform-specific setup (macOS / Windows / Linux)

### npx skills (recommended)

Install all skills at once:

```bash
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding --all
```

Install a specific version (via Git tag):

```bash
npx skills add https://github.com/TE-9004076594/skills-pool/tree/ai-coding-v1.0.0/ai-coding --all
```

Install to a specific agent only:

```bash
npx skills add https://github.com/TE-9004076594/skills-pool/tree/main/ai-coding -s '*' -a claude-code
```

> **⚠️ Common error on Windows**: If interactive mode (without `--all`) shows:
> ```
> ✗ find-skills → PromptScript: PromptScript does not support global skill installation
> ```
> **Fix**: Add `--all` to skip interactive selection.

### Claude Code

```
/plugin marketplace add TE-9004076594/skills-pool
```

### Cursor

Settings → Rules → Add Rule → Remote Rule (GitHub) and use `TE-9004076594/skills-pool`.

## Updating

```bash
# Update all installed skills
npx skills update

# Update global or project-level only
npx skills update -g     # global
npx skills update -p     # project-level only
```

Update CodeGraph index after code changes:

```bash
codegraph sync -q
```

## Structure

```
ai-coding/
├── .claude-plugin/           # Claude Code plugin config
│   └── plugin.json           #   skills: "./skills/"
├── .cursor-plugin/           # Cursor plugin config
│   └── plugin.json           #   skills: ["skills"]
├── .github/
│   └── copilot-instructions.md
├── AGENTS.md                 # Guidance for editing this package
├── assets/
│   └── logo.svg
├── commands/
│   └── opsx/                 # OpenSpec slash command definitions
│       ├── apply.md
│       ├── archive.md
│       ├── explore.md
│       ├── propose.md
│       ├── sync.md
│       ├── trace-log.md
│       ├── verify.md
│       └── android-bug.md
└── skills/
    ├── llms.txt              # Skill index for agents (names, summaries, triggers)
    ├── openspec-propose/
    ├── openspec-apply/
    ├── openspec-explore/
    ├── openspec-archive/
    ├── openspec-sync-specs/
    ├── openspec-android-bug/
    ├── openspec-trace-logger/
    ├── openspec-verify/
    ├── opsx-propose/
    ├── opsx-apply/
    ├── opsx-explore/
    ├── opsx-verify/
    ├── opsx-sync/
    ├── opsx-archive/
    ├── opsx-android-bug/
    ├── opsx-trace-log/
    ├── android-crash-analyzer/
    ├── android-anr-investigator/
    ├── android-lifecycle-debugger/
    ├── android-memory-leak-fixer/
    ├── android-network-bug-debugger/
    ├── android-ui-regression-checker/
    ├── android-camera-bugfix-skill/
    └── android-gallery-bugfix-skill/
```

## License

MIT
