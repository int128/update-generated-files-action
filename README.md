# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is an action for auto-fixing generated files.
It is equivalent to `git commit && git push origin` command.

You can use this action for the following use cases:

- Formatter such as Prettier, dprint or gofmt
- Linter such as ESLint, Biome or golangci-lint
- Update a lock file such as `package-lock.json`, `yarn.lock` or `go.sum`
- OpenAPI Generator
- GraphQL Code Generator

## Getting Started

Here is an example workflow to update the generated files.

```yaml
name: graphql-codegen

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Required to push a commit
      pull-requests: write # Required to create a pull request
    steps:
      - uses: actions/checkout@v5
      # Something to generate files
      - run: pnpm run graphql-codegen
      # When the workspace is changed, this action will push a commit.
      - uses: int128/update-generated-files-action@v2
```

## How it works

### On `pull_request` event

If the working directory has been changed, this action pushes a new commit.
Otherwise, it does nothing.

When this action is triggered on `opened` or `synchronize` type of `pull_request` event,
it intentionally exits with the error to prevent Renovate or Dependabot from auto-merging the pull request.

```console
Error: Added a commit. CI should pass on the new commit.
```

When the workspace is checked out from [the merge branch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request),
this action cherry-picks the changes onto the head branch of the pull request.
If it conflicts, the action merges the base branch into the head branch and then cherry-picks the changes.

You can customize the commit as follows:

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          # Set a custom message to the new commit (optional)
          commit-message: "fix: graphql-codegen"
```

### On other events

When this action is triggered on other events such as `push` or `schedule`,
it tries to apply the change by the following order:

1. Push the change into the branch by fast-forward.
2. Create a pull request for the branch. If the pull request already exists, update it.

For example, when this action is triggered on `push` event to `main` branch,
it pushes a new commit to `main` branch.
If it fails due to the branch rule, it creates a new pull request.

This action creates a new pull request every time by default.
If you want to create or update a pull request for each workflow, you can set `head-branch-keys` input.

This action requests a review to the current actor by default.
If `reviewers` input is set, it requests a review to the specified users or teams.

You can customize the pull request as follows:

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          # Set a custom title or body to the pull request (optional)
          title: Regenerate graphql code
          body: Updated by `yarn graphql-codegen`
          # Request reviewers for the pull request (optional)
          reviewers: |
            username
            org/team
          # Create a draft pull request (optional)
          # This is useful to prevent CODEOWNERS from receiving a review request.
          draft: true
          # Add labels to the pull request (optional)
          labels: |
            updated-graphql-codegen
          # Set a custom message to the new commit (optional)
          commit-message: "fix: graphql-codegen"
          # Enable auto-merge for the pull request (optional)
          enable-auto-merge: true
          auto-merge-method: squash
```

## Best practices

### Trigger a workflow on the new commit

The default token does not trigger a workflow on the new commit due to [the specification of GitHub Actions](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow).

To trigger a workflow on the new commit, you need to explicitly set a GitHub token.

```yaml
jobs:
  generate:
    steps:
      - id: ci-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.YOUR_CI_GITHUB_APP_ID }}
          private-key: ${{ secrets.YOUR_CI_GITHUB_APP_PRIVATE_KEY }}
      - uses: int128/update-generated-files-action@v2
        with:
          token: ${{ steps.ci-token.outputs.token }}
```

### Working with Renovate or Dependabot

You can update both dependencies and generated files as follows:

1. Renovate or Dependabot creates a pull request to update a dependency.
1. GitHub Actions triggers the workflow.
1. If the workspace is changed, this action adds a commit to the pull request.
   It intentionally exits with the error to prevent auto-merging.
1. GitHub Actions triggers the workflow against the new commit.

### Auto-merge a pull request securely

You can merge a pull request created by this action without human approval.
For example, a scheduled workflow updates a file and the pull request is merged automatically.

To do this securely, set up a dedicated GitHub App and repository rulesets as follows:

- Restrict the credentials of the GitHub App to the default branch.
  This ensures that only the reviewed code can issue the token of the GitHub App.
  For example,
  - Store the credentials into the secrets of an environment, and restrict the deployment branches of the environment.
  - Store the credentials into a cloud secret manager, and restrict the access by the OIDC token of GitHub Actions,
    such as `repo:OWNER/REPO:ref:refs/heads/main`.
- Create the head branch with a dedicated prefix, such as `auto-merge/`.
- Add a ruleset to restrict creation and update of `auto-merge/**` branches.
  Add the GitHub App to the bypass list.
  This ensures that nobody else can push a commit to the pull request.
- Put the pull request approval rule into a separate ruleset.
  Add the GitHub App to the bypass list with the `exempt` mode.
  If you choose the `always` mode, auto-merge waits for an approval.
- Keep the required status checks without bypass.

Here is an example workflow using an environment.

```yaml
on:
  schedule:
    - cron: "0 0 * * 1"

jobs:
  update:
    runs-on: ubuntu-latest
    environment: auto-merge
    steps:
      - uses: actions/checkout@v5
      - run: ./update-something.sh
      - id: auto-merge-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.AUTO_MERGE_APP_ID }}
          private-key: ${{ secrets.AUTO_MERGE_APP_PRIVATE_KEY }}
      - id: update-generated-files
        uses: int128/update-generated-files-action@v2
        with:
          token: ${{ steps.auto-merge-token.outputs.token }}
          head-branch-prefix: auto-merge/
          enable-auto-merge: true
          auto-merge-method: squash
```

This action enables auto-merge with the token of the GitHub App.
A pull request is merged by the user who enabled auto-merge.
Auto-merge requires "Allow auto-merge" in the repository settings and the required status checks.
If this action could not enable auto-merge, it shows a warning and continues.

## Specification

If the last 5 commits were committed by this action, it stops with an error to prevent an infinite loop.

### Inputs

These inputs are available on all events.

| Name             | Default        | Description                      |
| ---------------- | -------------- | -------------------------------- |
| `commit-message` | \*1            | Commit message                   |
| `dry-run`        | false          | If true, do not push the changes |
| `token`          | `github.token` | GitHub token                     |

These inputs are available only on other events (not `pull_request` event),
because this action creates a pull request only on other events.

| Name                 | Default                    | Description                                                |
| -------------------- | -------------------------- | ---------------------------------------------------------- |
| `head-branch-prefix` | `update-generated-files--` | Prefix of the head branch name of a pull request to create |
| `head-branch-keys`   | \*1                        | Keys of the head branch name of a pull request to create   |
| `title`              | \*1                        | Title of the pull request                                  |
| `body`               | \*1                        | Body of the pull request                                   |
| `draft`              | false                      | If true, create a draft pull request \*2                   |
| `reviewers`          | (optional)                 | Request reviewers for the pull request (multiline)         |
| `labels`             | (optional)                 | Add labels to the pull request (multiline)                 |
| `enable-auto-merge`  | false                      | If true, enable auto-merge on the pull request \*2         |
| `auto-merge-method`  | `squash`                   | Merge method of auto-merge (`merge`, `squash` or `rebase`) |

\*1: See [action.yaml](action.yaml) for the default value.
\*2: Do not set both `draft` and `enable-auto-merge`.

### Outputs

| Name                  | Description                            |
| --------------------- | -------------------------------------- |
| `pull-request-number` | Number of pull request <sup>\*1</sup>  |
| `pull-request-id`     | Node ID of pull request <sup>\*1</sup> |
| `pull-request-url`    | URL of pull request <sup>\*1</sup>     |

<sup>\*1</sup>: Available only when this action created a pull request on other events.

### Exit status

If git-diff returns no changes, this action exits successfully.

If git-diff returns changes, this action exits with the following status:

- When triggered on `push` event, it exits with the error.
  It indicates that the branch is inconsistent state.
- When triggered on `opened` type of `pull_request` event, it exits with the error.
  It prevents Renovate or Dependabot from auto-merging.
- When triggered on `synchronize` type of `pull_request` event, it exits with the error.
  It prevents Renovate or Dependabot from auto-merging.
- Otherwise, it exits successfully.

If you need to refer the outputs after this action, you can specify `always()` in the consequent step.
For example,

```yaml
steps:
  - id: update-generated-files
    uses: int128/update-generated-files-action
  # Something to manipulate the created pull request
  - if: always() && steps.update-generated-files.outputs.pull-request-number != ''
    run: gh pr edit ${{ steps.update-generated-files.outputs.pull-request-number }}
```
