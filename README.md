# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is an action for auto-fix of generated files.
It pushes the current change to the pull request, i.e., `git commit && git push origin`.

Here are the example use-cases.

- Format code such as Prettier, dprint or `gofmt`
- Update a lock file such as `package-lock.json`, `yarn.lock` or `go.sum`
- ESLint with `--fix`
- OpenAPI Generator
- GraphQL Code Generator

## Getting Started

Here is an example workflow.

```yaml
on:
  pull_request:
  push:
    branches:
      - main

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      # required to push a commit
      contents: write
      # required to create a pull request
      pull-requests: write
    steps:
      - uses: actions/checkout@v3

      # something to generate files
      - run: yarn graphql-codegen

      # push the change if exists
      - uses: int128/update-generated-files-action@v2
```

### On `pull_request` event

When the workflow is run on `pull_request` event, this action adds the current change into the head branch.
If there is no change in the current directory, this action does nothing.

For example, if `yarn graphql-codegen` updated the code, this action adds a commit of the change.

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232302693-7eace408-52be-488b-897e-27594d391611.png">

Because the workflow should pass on the new commit, this action exits with the following failure:

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232303622-a4d7b868-5300-4dda-b1e5-9ef0e8d5985b.png">

By default, `actions/checkout` checks out [the merge branch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request).
This action works on both merge branch or head branch.

If the last 5 commits are added by this action, it exits with an error to prevent the infinite loop.

You can customize the commit as follows:

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          # set a custom message to the new commit (optional)
          commit-message: "Fix: yarn graphql-codegen"
```

### On `push` or other events

When the workflow is run on other events such as `push` or `schedule`,
this action tries to apply the current change by the following order:

1. Push the current change into the branch by fast-forward
2. Create a pull request for the branch

If there is no change, this action does nothing.

For example, if `yarn graphql-codegen` updated the generated code in the workflow,
this action pushes a commit to `main` branch.

<img width="1050" alt="image" src="https://user-images.githubusercontent.com/321266/222304713-6048e97f-9db1-4208-9bff-45892c14c47c.png">

If push was failed due to the branch protection rule, the action creates a pull request.

<img width="920" alt="image" src="https://user-images.githubusercontent.com/321266/232307473-9180533d-898a-4192-a856-3cc695552162.png">

You can customize the pull request as follows:

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          # set a custom title or body to the pull request (optional)
          title: Regenerate graphql code
          body: Updated by `yarn graphql-codegen`
          # request reviewers for the pull request (optional)
          reviewers: |
            username
            org/team
          # set a custom message to the new commit (optional)
          commit-message: "Fix: yarn graphql-codegen"
```

## Best practices

### Triggering GitHub Actions on the new commit

This action uses the default token by default, but [it does not trigger a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow) on the new commit.
You need to reopen a pull request to trigger a workflow.

To trigger a workflow on the new commit, you need to set a personal access token or GitHub App token.

```yaml
jobs:
  generate:
    steps:
      - uses: int128/update-generated-files-action@v2
        with:
          token: ${{ secrets.YOUR_TOKEN }}
```

### Maintain code by team

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

### Working with Renovate

You can update both dependencies and generated files as follows:

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. This action pushes a change if it exists
1. GitHub Actions triggers a workflow against the new commit

If the generated files are inconsistent, automerge will be stopped due to the failure of this action.

## Specification

### Inputs

| Name | Default | Description
|------|----------|------------
| `commit-message` | [action.yaml](action.yaml) | Commit messgae
| `commit-message-footer` | [action.yaml](action.yaml) | Footer of commit message
| `title` | [action.yaml](action.yaml) | Title of the pull request
| `body` | [action.yaml](action.yaml) | Body of the pull request
| `reviewers` | (optional) | Request reviewers for the pull request
| `token` | `github.token` | GitHub token

### Outputs

None.
