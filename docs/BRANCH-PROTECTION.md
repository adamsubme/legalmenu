# Branch Protection Rules

## Required Configuration

### Main Branch (`main`)

1. **Go to**: GitHub → Repository → Settings → Branches → Add rule

2. **Branch name pattern**: `main`

3. **Required settings**:
   - ☑️ Require pull request reviews before merging
     - Required approving reviewers: **1**
     - ☑️ Dismiss stale reviews when new commits push
     - ☑️ Require review from Code Owners
   - ☑️ Require status checks to pass before merging
     - Required checks: `CI`, `build`
     - ☑️ Require branches to be up to date before merging
   - ☑️ Require signed commits
   - ☑️ Do not allow bypassing the above rules

### Dev Branch (`dev`)

1. **Branch name pattern**: `dev`

2. **Required settings**:
   - ☑️ Require pull request reviews before merging
     - Required approving reviewers: **1**
   - ☑️ Require status checks to pass before merging
     - Required checks: `CI`

## GitHub Secrets Required for CI/CD

Add these secrets in GitHub → Repository → Settings → Secrets and variables → Actions:

| Secret Name | Description |
|------------|-------------|
| `SERVER_HOST` | Production server hostname/IP |
| `SERVER_USER` | SSH username for deployment |
| `SERVER_SSH_KEY` | Private SSH key (with corresponding public key on server) |

## Workflow Triggers

| Branch | CI Runs On | Deploy Runs On |
|--------|-----------|----------------|
| `main` | Every push + PR | Every push (after CI passes) |
| `dev` | Every push + PR | Manual trigger only |

## Deployment Flow

```
dev branch
    │
    ▼
Create PR ──────────────────┐
    │                       │
    ▼                       ▼
CI Tests ──────────► If fail: Block merge
    │                       │
    ▼                       │
Code Review                 │
    │                       │
    ▼                       │
Approval ───────────────────┘
    │
    ▼
Merge to main
    │
    ▼
Deploy workflow triggers
    │
    ▼
SSH to server
    │
    ▼
pm2 restart
```
