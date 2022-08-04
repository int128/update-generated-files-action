# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is a general-purpose action to keep consistency of the generated files.

Here are example use-cases.

- Code formatter
  - Prettier
  - gofmt
- Code generator
  - OpenAPI Generator
  - GraphQL Code Generator
  - gRPC
  - SQL


## Getting Started

Create a workflow to regenerate files and then run this action.

```yaml
on:
  push:
    branches:
      - main
  pull_request:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.head_ref }}

      # something to regenerate files
      - run: yarn
      - run: yarn format

      - uses: int128/update-generated-files-action@v2
```

### For pull request event

If `git status` returns any change, this action pushes the change to the head branch.
Otherwise, it does nothing.

You need to explicitly checkout the head branch.

```yaml
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.head_ref }}
```

### For push or other events

If `git status` returns any change, this action creates a pull request to fix the inconsistency.
Otherwise, it does nothing.

Here is an example of created pull request.

<img width="1250" alt="image" src="https://user-images.githubusercontent.com/321266/154795860-5bd982b4-2706-4a04-b3c3-2458124853b8.png">


### Re-trigger GitHub Actions for new commit

This action uses `GITHUB_TOKEN` by default, but [it does not trigger a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow) for the new commit.

To re-trigger GitHub Actions for the new commit, you need to specify a personal access token or GitHub App token.

```yaml
      # something to regenerate files
      - run: yarn format

      - uses: int128/update-generated-files-action@v2
        with:
          token: ${{ secrets.YOUR_PERSONAL_ACCESS_TOKEN }}
```


## Working with Renovate

You can update both dependencies and generated files as follows:

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. This action pushes a change if it exists

If the generated files are inconsistent, automerge will be prevented due to the failure of this action.


## Specification

If `git status` returns any change, this action fails.

If the author of last commit was this action, it stops to prevent infinite loop.

### Inputs

| Name | Default | Description
|------|----------|------------
| `token` | `github.token` | GitHub token
