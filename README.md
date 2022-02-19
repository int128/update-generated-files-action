# update-generated-files-action [![ts](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/ts.yaml)

This is a general-purpose action to update generated files on a pull request.

It synchronizes source and generated files as follows:

- Push a change on pull request event
- Ensure no change on push event


## Getting Started

This action is designed to work on a head branch of pull request.

Here is an example.

```yaml
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: ${{ github.head_ref }}

      # something to regenerate files
      - run: yarn
      - run: yarn generate

      - uses: int128/update-generated-files-action@v2
```

If there is a change (i.e. `git status` returned any change), this action pushes the change to the branch.
Otherwise, it does nothing.

This action intentionally fails if there is a change on push event.
It is a rare case because every changes should be checked via pull requests.


## Working with Renovate

You can update dependencies using Renovate and this action.

1. Renovate creates a pull request to update a dependency
1. GitHub Actions triggers a workflow
1. update-generated-files-action pushes a change if it exists


## Specification

### Inputs

| Name | Default | Description
|------|----------|------------
| `committer-name` | `github-actions[bot]` | A value for git config user.name
| `committer-email` | see action.yaml | A value for git config user.email
| `message` | `update-generated-files` | A value for git commit --message
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
