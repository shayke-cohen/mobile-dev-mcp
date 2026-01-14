# Create Pull Request

Create a well-structured pull request for your changes.

## Steps

### 1. Ensure Code Quality
```bash
yarn typecheck
yarn lint
yarn test
```

Fix any issues before proceeding.

### 2. Review Your Changes
```bash
git status
git diff
```

Make sure:
- Only intended files are changed
- No debug code or console.logs left
- No sensitive data (keys, passwords)

### 3. Create Descriptive Commits

If you haven't committed yet:
```bash
git add -A
git commit -m "feat: description of what this adds"
```

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance

### 4. Push Your Branch
```bash
git push -u origin your-branch-name
```

### 5. Create the PR

Use this template for the PR description:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Change 1
- Change 2
- Change 3

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation
- [ ] Tests

## Testing
Describe how you tested these changes:
- [ ] Unit tests pass
- [ ] Tested with React Native demo
- [ ] Tested with iOS demo
- [ ] Tested with Android demo

## Screenshots (if UI changes)
Add screenshots here.

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)
```

### 6. After Creating PR

- Request reviewers
- Add appropriate labels
- Link related issues
- Respond to review feedback promptly
