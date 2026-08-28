# Branch Protection Rules

Configure these rules in GitHub → Settings → Branches → Add rule:

## Branch: `main`

### Required Status Checks
- [x] Require status checks to pass before merging
  - `Test Backend (Go)`
  - `Test Frontend (React)`
  - `Lint`

### Pull Requests
- [x] Require pull request reviews before merging
  - Required approving reviews: 1
- [x] Dismiss stale pull request approvals when new commits are pushed

### Restrictions
- [x] Require branches to be up to date before merging
- [ ] Restrict who can push to matching branches (optional)

### Rules
- [x] Require conversation resolution before merging
- [x] Require linear history (squash merges)

## Branch: `staging`

### Required Status Checks
- [x] Require status checks to pass before merging
  - `Test Backend (Go)`
  - `Test Frontend (React)`

### Deploy
- Auto-deploys to staging environment on push
