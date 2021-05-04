# update-generated-files-action [![test](https://github.com/int128/update-generated-files-action/actions/workflows/test.yaml/badge.svg)](https://github.com/int128/update-generated-files-action/actions/workflows/test.yaml)

This is a general-purpose action to update generated files on a pull request.

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

      - uses: int128/update-generated-files-action@main
```

If there is a change (i.e. difference between source and generated files), this action pushes the change to the branch.
Otherwise, it does nothing.

This action intentionally fails if there is a change on push event.
It is a rare case because every changes should be checked via pull requests.


## Continuous dependency update

You can use this action with Dependabot or Renovate to update both source and generated files.
