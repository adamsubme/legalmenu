# Commit Standards

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, semicolons, etc) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

## Examples

```
feat(auth): add two-factor authentication
fix(api): correct user endpoint response format
docs(readme): update deployment instructions
refactor(db): extract connection pooling logic
```

## Rules

1. **Subject line**: max 72 characters
2. **Use imperative mood**: "add feature" not "added feature"
3. **No period** at end of subject
4. **Reference issues**: `fix #123` or `closes #456`
5. **Breaking changes**: `feat(api)!: change response format` or in footer: `BREAKING CHANGE: ...`

## Branch Naming

```
<type>/<issue-number>-<short-description>
```

Examples:
- `feat/123-user-authentication`
- `fix/456-session-timeout`
- `hotfix/789-critical-security-patch`
