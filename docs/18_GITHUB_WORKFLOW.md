# 18. GitHub & Git Development Workflow

## 🔄 Commit & Release Pipeline

Every development cycle follows the strict **Check $\to$ Test $\to$ Build $\to$ Commit $\to$ Push** pipeline:

```
1. Type Check & Lint:
   ruff check src/ tests/
   mypy src/

2. Automated Tests:
   pytest tests/

3. Build Check:
   pip install -e .

4. Commit with Conventional Format:
   git commit -m "feat(scope): descriptive summary"

5. Push & Progress Log Update:
   git push origin main
```

---

## 🏷️ Conventional Commit Types

- `feat`: New feature or user-facing capability
- `fix`: Bug fix in runtime, CDP, or verification engine
- `refactor`: Architectural refactoring without changing user behavior
- `docs`: Documentation updates
- `test`: Unit, integration, or E2E tests
- `chore`: Build config, dependency updates
