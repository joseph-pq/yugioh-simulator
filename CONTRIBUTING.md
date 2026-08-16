# Contributing

Contributions are welcome! Please follow these steps:

## 1. Open an Issue

Before writing any code, open an issue describing the bug or feature request.  
This lets us discuss the approach before any work begins.

## 2. Fork & Branch

Create a branch from `main` named after the issue:

```bash
git checkout -b feat/123-short-description
# or
git checkout -b fix/456-short-description
```

## 3. Make Your Changes

Keep commits small and focused.  
Use **[Conventional Commits](https://www.conventionalcommits.org/)** format:

```
<type>(<scope>): <short description>

feat(simulator): add card hover animation
fix(deck-builder): correct card count validation
docs(readme): update installation steps
refactor(context): extract combo helpers
chore(deps): bump vite to 8.3
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`.

## 4. Open a Pull Request

- Target the `main` branch.
- Reference the issue in the PR description: `Closes #123`.
- Keep the PR focused on a single concern.
