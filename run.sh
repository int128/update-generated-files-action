#!/bin/bash
set -o pipefail
set -eux

status="$(git status --porcelain)"
if [ -z "$status" ]; then
  : nothing to commit
  exit 0
fi

git diff

git config user.name "$GIT_COMMITTER_NAME"
git config user.email "$GIT_COMMITTER_EMAIL"

if [[ $GITHUB_EVENT_NAME == push ]]; then
  echo "::error::${GITHUB_REF} is broken because there is difference between source and generated files"

  # install if needed
  # https://github.com/cli/cli/blob/trunk/docs/install_linux.md
  if ! gh version; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update
    sudo apt install gh
  fi

  # create a pull request to follow up
  base_branch="${GITHUB_REF##*/}"
  topic_branch="update-generated-files-${GITHUB_SHA}"
  git checkout -b "$topic_branch"
  git add .
  git status
  git commit -m "$GIT_MESSAGE"
  git push origin "$topic_branch"
  gh pr create \
    --head "$topic_branch" --base "$base_branch" \
    --title "Update generated files" \
    --body "Hi @${GITHUB_ACTOR}, ${base_branch} branch is broken because there is difference between source and generated files at ${GITHUB_SHA}. This PR will fix the diff." \
    --label 'update-generated-files' \
    --reviewer "$GITHUB_ACTOR" \
    --assignee "$GITHUB_ACTOR"

  exit 1
fi

# append a commit
git add .
git status
git commit -m "$GIT_MESSAGE"
git push

echo "::set-output name=updated-sha::$(git rev-parse HEAD)"
