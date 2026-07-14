---
name: rtk-token-optimization
description: 'Reduce token consumption on shell command outputs using RTK (.rtk\bin\rtk.exe). Use when running git, gh, test, build, lint, package-manager, or any command whose output will be returned to the LLM context.'
---

# RTK Token Optimization

RTK (Rust Token Killer) filters and compresses command outputs before they enter the LLM context. Assume rtk binary is installed & in the path. Use RTK when running git, gh, test, build, lint, package-manager, or any command whose output will be returned to the LLM context.

**Environment:** Set `RTK_TELEMETRY_DISABLED=1` before any RTK invocation.

## Command Mapping

Prefix every command below with `rtk.exe` instead of running the raw command.

### Git

| Raw command           | RTK equivalent                |
| --------------------- | ----------------------------- |
| `git status`          | `rtk.exe git status`          |
| `git log`             | `rtk.exe git log`             |
| `git diff`            | `rtk.exe git diff`            |
| `git add .`           | `rtk.exe git add .`           |
| `git commit -m "msg"` | `rtk.exe git commit -m "msg"` |
| `git push`            | `rtk.exe git push`            |
| `git pull`            | `rtk.exe git pull`            |

### Test Runners

| Raw command                | RTK equivalent          |
| -------------------------- | ----------------------- |
| `npm test` / `npx jest`    | `rtk.exe jest`          |
| `npx vitest`               | `rtk.exe vitest`        |
| `pytest`                   | `rtk.exe pytest`        |
| `go test ./...`            | `rtk.exe go test ./...` |
| `cargo test`               | `rtk.exe cargo test`    |
| `mvn test` / `gradle test` | `rtk.exe test mvn test` |

### Build & Lint

| Raw command    | RTK equivalent         |
| -------------- | ---------------------- |
| `npx tsc`      | `rtk.exe tsc`          |
| `npx eslint .` | `rtk.exe lint`         |
| `cargo build`  | `rtk.exe cargo build`  |
| `cargo clippy` | `rtk.exe cargo clippy` |
| `ruff check .` | `rtk.exe ruff check .` |

### Package Managers

| Raw command              | RTK equivalent         |
| ------------------------ | ---------------------- |
| `pip list`               | `rtk.exe pip list`     |
| `pip outdated`           | `rtk.exe pip outdated` |
| `npm list` / `pnpm list` | `rtk.exe pnpm list`    |

### Containers & Cloud

| Raw command        | RTK equivalent            |
| ------------------ | ------------------------- |
| `docker ps`        | `rtk.exe docker ps`       |
| `docker logs <c>`  | `rtk.exe docker logs <c>` |
| `kubectl get pods` | `rtk.exe kubectl pods`    |

### GitHub CLI

| Raw command                 | RTK equivalent          |
| --------------------------- | ----------------------- |
| `gh pr list` / `gh pr view` | `rtk.exe gh pr list`    |
| `gh issue list`             | `rtk.exe gh issue list` |
| `gh run list`               | `rtk.exe gh run list`   |

### Unlisted commands — generic fallback

RTK covers 100+ tools; for anything not listed above, use a generic wrapper instead of running raw:

- `rtk.exe err <cmd>` — keep only the errors from any command
- `rtk.exe test <cmd>` — failures only, for any test runner
- `rtk.exe proxy <cmd>` — passthrough with token tracking

## Usage Rules

1. **Wrap only outputs that return to context.** If a command's output is not read by the LLM (e.g., background process, piped to file), run it raw.
2. **On failure, read the tee log.** RTK saves unfiltered output on failure. Read the log path shown in the output instead of re-executing the command.
3. **Use `--ultra-compact` (`-u`) for extra savings** when only pass/fail matters (e.g., `git push`, `git add`).
4. **Always set `RTK_TELEMETRY_DISABLED=1`** — no telemetry.

## When NOT to Use RTK

- **Verbatim output needed** — when debugging raw command output or comparing exact bytes
- **Interactive commands** — anything requiring stdin (prompts, confirmations, editors)
- **No useful structure to filter** — truly arbitrary output (though `rtk.exe err` / `rtk.exe proxy` still help); PowerShell cmdlets that bypass the shell
- **IDE built-in tools** — read_file, grep_search, semantic_search, and other VS Code tool calls bypass the shell; RTK cannot wrap them
- **User explicitly asks for raw output** — respect the request
