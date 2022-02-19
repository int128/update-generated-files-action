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

### For pull request event

If `git status` returns any change, this action pushes the change to the head branch.
Otherwise, it does nothing.

You need to explicitly checkout the head branch.
Note that `actions/checkout@v2` checkouts a merged commit from the default branch.

### For push or other events

If `git status` returns any change, this action creates a pull request to fix the inconsistency.
Otherwise, it does nothing.

Here is an example of created pull request.

<img width="1250" alt="image" src="https://user-images.githubusercontent.com/321266/154795860-5bd982b4-2706-4a04-b3c3-2458124853b8.png">


## Working with Renovate

You can update both dependencies and generated files as follows:

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. This action pushes a change if it exists

If the generated files are inconsistent, automerge will be prevented due to the failure of this action.


## Specification

If `git status` returns any change, this action fails.

### Inputs

| Name | Default | Description
|------|----------|------------
| `token` | `github.token` | GitHub token


## Development

### Release workflow

When a pull request is merged into main branch, a new minor release is created by GitHub Actions.
See https://github.com/int128/release-typescript-action for details.

### Dependency update

You can enable Renovate to update the dependencies.
This repository is shipped with the config https://github.com/int128/typescript-action-renovate-config.
