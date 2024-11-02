# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is an action for auto-fixing generated files.
It is equivalent to `git commit && git push origin` command.

You can use this action for the following use cases:

- Format code such as Prettier, dprint or `gofmt`
- Update a lock file such as `package-lock.json`, `yarn.lock` or `go.sum`
- ESLint with `--fix`
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
      - uses: actions/checkout@v4

      # Something to generate files
      - run: yarn graphql-codegen

      # If the generated files are updated, this action pushes a commit.
      - uses: int128/update-generated-files-action@v2
```

### How it works on `pull_request` event

If `yarn graphql-codegen` updated your code, this action pushes a new commit.

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232302693-7eace408-52be-488b-897e-27594d391611.png">

This action intentionally exits with the error to prevent Renovate or Dependabot from auto-merging the pull request.

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232303622-a4d7b868-5300-4dda-b1e5-9ef0e8d5985b.png">

If the working directory has no change, this action does nothing.

You can customize the commit as follows:

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          # Set a custom message to the new commit (optional)
          commit-message: 'Fix: yarn graphql-codegen'
```

### How it works on `push` or other events

When the workflow is run on other events such as `push` or `schedule`,
this action tries to apply the current change by the following order:

1. Push the current change into the branch by fast-forward
2. Create a pull request for the branch

If the working directory has no change, this action does nothing.

For example, if `yarn graphql-codegen` updated your code,
this action pushes a new commit to `main` branch.

<img width="1050" alt="image" src="https://user-images.githubusercontent.com/321266/222304713-6048e97f-9db1-4208-9bff-45892c14c47c.png">

If this action could not push it due to the branch rule, it creates a new pull request.

<img width="920" alt="image" src="https://user-images.githubusercontent.com/321266/232307473-9180533d-898a-4192-a856-3cc695552162.png">

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
          commit-message: 'Fix: yarn graphql-codegen'
```

## Best practices

### Trigger GitHub Actions on the new commit

This action uses the default token by default, but [it does not trigger a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow) on the new commit.
You need to reopen a pull request to trigger a workflow.

To trigger a workflow on the new commit, you need to set a personal access token or GitHub App token.

```yaml
jobs:
  generate:
    steps:
      - uses: actions/create-github-app-token@v1
        id: ci-token
        with:
          app-id: ${{ secrets.YOUR_CI_GITHUB_APP_ID }}
          private-key: ${{ secrets.YOUR_CI_GITHUB_APP_PRIVATE_KEY }}
      - uses: int128/update-generated-files-action@v2
        with:
          token: ${{ steps.ci-token.outputs.token }}
```

### Maintain code by owners

It is recommended to set **CODEOWNERS** to receive a review request when this action creates a pull request.
Alternatively, you can set the reviewers, for example,

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          reviewers: |
            your-organization/frontend-devs
```

### Work with Renovate or Dependabot

You can update both dependencies and generated files as follows:

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. This action pushes a change if it exists
1. GitHub Actions triggers a workflow against the new commit

If the generated files are inconsistent, automerge will be stopped due to the failure of this action.

## Specification

If the last 5 commits are added by this action, it exits with an error to prevent the infinite loop.

By default, `actions/checkout` checks out [the merge branch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request).
This action works on both merge branch or head branch.

### Inputs

| Name                    | Default                    | Description                                        |
| ----------------------- | -------------------------- | -------------------------------------------------- |
| `commit-message`        | [action.yaml](action.yaml) | Commit message                                     |
| `commit-message-footer` | [action.yaml](action.yaml) | Footer of commit message                           |
| `title`                 | [action.yaml](action.yaml) | Title of the pull request                          |
| `body`                  | [action.yaml](action.yaml) | Body of the pull request                           |
| `draft`                 | false                      | If true, create a draft pull request               |
| `reviewers`             | (optional)                 | Request reviewers for the pull request (multiline) |
| `labels`                | (optional)                 | Add labels to the pull request (multiline)         |
| `token`                 | `github.token`             | GitHub token                                       |

### Outputs

| Name                  | Description                           |
| --------------------- | ------------------------------------- |
| `pull-request-number` | Number of pull request <sup>\*1</sup> |
| `pull-request-url`    | URL of pull request <sup>\*1</sup>    |

<sup>\*1</sup>: Available only when this action created a pull request.

### Exit status

If the working directory does not have git-diff, this action exits successfully.

If the working directory has git-diff,
this action exits with the following status:

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
- uses: int128/update-generated-files-action
  id: update-generated-files

# Something to manipulate the created pull request
- if: always() && steps.update-generated-files.outputs.pull-request-number != ''
  run: gh pr ${{ steps.update-generated-files.outputs.pull-request-number }}
```
