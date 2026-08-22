# Deep-Browser Git Workflow Guide

All contributions and agent executions must follow the standard Git branching and verification workflow.

## 🌿 Branching Strategy

- `main`: Production-ready, fully tested releases.
- `develop`: Ongoing integration branch.
- `feature/*`: Specific capabilities (e.g. `feature/cdp-session-manager`).
- `fix/*`: Bug fixes and regression repairs.

## 📋 Pre-Commit Checklist

1. **Format and lint**: Verify code quality (`ruff check src/`).
2. **Execute Unit & Integration tests**: Run `pytest tests/`.
3. **Verify Documentation**: Update `docs/22_PROGRESS.md` with milestone state.
4. **Sign Off**: Commit with meaningful message and push.
