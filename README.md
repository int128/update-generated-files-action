# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is an action to update generated files, such as Prettier, ESLint, gofmt, go mod tidy, OpenAPI Generator or GraphQL Code Generator.
It pushes the change to the head branch of pull request, i.e., runs `git commit && git push origin head`.

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

For the above example, if `yarn graphql-codegen` updated the code, this action adds a commit of the change.

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232302693-7eace408-52be-488b-897e-27594d391611.png">

Because the workflow should pass on the new commit, this action exits with the following failure:

<img width="870" alt="image" src="https://user-images.githubusercontent.com/321266/232303622-a4d7b868-5300-4dda-b1e5-9ef0e8d5985b.png">

By default, `actions/checkout` checks out [the merge branch](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request). This action works on both merge branch or head branch.

### On `push` or other events

When the workflow is run on other events such as `push` or `schedule`, this action creates a new pull request with the change.
If there is no change in the current directory, this action does nothing.

For example, there is any change on `main` branch,

<img width="1050" alt="image" src="https://user-images.githubusercontent.com/321266/222304713-6048e97f-9db1-4208-9bff-45892c14c47c.png">

This action creates the following pull request:

<img width="1230" alt="image" src="https://user-images.githubusercontent.com/321266/222304367-2b52f387-ff40-41fa-b7af-b7f68e570a13.png">

## Considerations

### Triggering GitHub Actions

This action uses the default token by default, but [it does not trigger a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow) for the new commit.
You can reopen a pull request to trigger a workflow.

To trigger a workflow on the new commit, you need to set a personal access token or GitHub App token.

```yaml
      - uses: int128/update-generated-files-action@v2
        with:
          token: ${{ secrets.YOUR_PERSONAL_ACCESS_TOKEN }}
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
| `commit-message` | see action.yaml | Commit messgae
| `commit-message-footer` | see action.yaml | Footer of commit message
| `title` | see action.yaml | Title of pull request
| `body` | see action.yaml | Body of pull request
| `token` | `github.token` | GitHub token

You can change the title or body of pull request.
For example,

```yaml
      - uses: int128/update-generated-files-action@v2
        with:
          title: Regenerate graphql code
          body: Updated by `yarn graphql-codegen`
          commit-message: "Fix: yarn graphql-codegen"
```

### Outputs

None.
