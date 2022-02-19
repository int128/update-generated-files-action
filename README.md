# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is a general-purpose action to keep consistency of the generated files.
For example,

- Code formatter (e.g., Prettier)
- Code generator (e.g., OpenAPI, gRPC or GraphQL)


## Getting Started

Create a workflow as follows:

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
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.head_ref }}

      # something to regenerate files
      - run: yarn
      - run: yarn format

      - uses: int128/update-generated-files-action@v2
```

### For pull request events

If `git status` returns any change, this action will push the change to the head branch.
You need to explicitly checkout the head branch.
Note that `actions/checkout@v2` checkouts a merged commit from the default branch.

### For push or other events

If `git status` returns any change, this action will create a pull request to fix the consistency.
Here is an example.

<img width="1250" alt="image" src="https://user-images.githubusercontent.com/321266/154795860-5bd982b4-2706-4a04-b3c3-2458124853b8.png">


## Working with Renovate

You can update both dependencies and generated files as follows:

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. This action pushes a change if it exists

If you are using Renovate Approve, you may need to stop the current workflow to prevent the automerge.
For example,

```yaml
      - uses: int128/update-generated-files-action@v2
        id: update-generated-files-action
      - name: stop this workflow when the branch is updated
        if: steps.update-generated-files-action.outputs.updated-sha
        run: exit 99
```


## Specification

### Inputs

| Name | Default | Description
|------|----------|------------
| `token` | `github.token` | GitHub token


### Outputs

| Name | Description
|------|------------
| `updated-sha` | SHA of a new commit if `git push` is done


## Development

### Release workflow

When a pull request is merged into main branch, a new minor release is created by GitHub Actions.
See https://github.com/int128/release-typescript-action for details.

### Dependency update

You can enable Renovate to update the dependencies.
This repository is shipped with the config https://github.com/int128/typescript-action-renovate-config.
