import * as core from '@actions/core'
import type { PullRequestEvent } from '@octokit/webhooks-types'
import * as git from './git.js'
import type { Context } from './github.js'
import type { Outputs } from './run.js'

const LIMIT_REPEATED_COMMITS = 5

type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  token: string
}

export const handlePullRequestEvent = async (inputs: Inputs, context: Context<PullRequestEvent>): Promise<Outputs> => {
  const headSHA = context.payload.pull_request.head.sha
  await git.fetch({ refs: [headSHA], depth: LIMIT_REPEATED_COMMITS, token: inputs.token })
  const lastAuthorNames = await git.getAuthorNameOfCommits(headSHA, LIMIT_REPEATED_COMMITS)
  if (lastAuthorNames.every((authorName) => authorName === git.AUTHOR_NAME)) {
    throw new Error(
      `This action has been called ${LIMIT_REPEATED_COMMITS} times. Stop the job to prevent infinite loop.`,
    )
  }

  const checkoutSHA = await git.getCurrentSHA()
  if (checkoutSHA === context.sha) {
    await updateHeadRefBasedOnMergeCommit(inputs, context)
  } else {
    await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
    const headRef = context.payload.pull_request.head.ref
    core.info(`Updating the head branch ${headRef}`)
    await git.showGraph()
    await git.push({ ref: `refs/heads/${headRef}`, token: inputs.token })
  }

  if (context.payload.action === 'opened' || context.payload.action === 'synchronize') {
    // Fail if the head ref is outdated
    core.summary.addRaw(`Added a commit. CI should pass on the new commit.`)
    await core.summary.write()
    throw new Error(`Added a commit. CI should pass on the new commit.`)
  }
  return {}
}

const updateHeadRefBasedOnMergeCommit = async (inputs: Inputs, context: Context<PullRequestEvent>) => {
  const parentSHAs = await git.getParentSHAs(context.sha)
  const headSHA = context.payload.pull_request.head.sha
  const baseSHA = parentSHAs.filter((sha) => sha !== headSHA).pop()
  if (baseSHA === undefined) {
    throw new Error(`could not determine base commit from parents ${String(parentSHAs)}`)
  }
  for (let depth = 50; depth < 1000; depth += 50) {
    if (await git.canMerge(baseSHA, headSHA)) {
      break
    }
    core.info(`Fetching more commits (depth ${depth})`)
    await git.fetch({ refs: [baseSHA, headSHA], depth, token: inputs.token })
  }

  await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
  const workspaceChangeSHA = await git.getCurrentSHA()

  const headRef = context.payload.pull_request.head.ref
  const baseRef = context.payload.pull_request.base.ref

  await git.checkout(headSHA)
  if (await git.tryCherryPick(workspaceChangeSHA)) {
    core.info(`Updating the head branch ${headRef}`)
    await git.showGraph()
    await git.push({ ref: `refs/heads/${headRef}`, token: inputs.token })
    return
  }

  // If this action pushes the merge commit (refs/pull/x/merge) into the head branch,
  // we may see the unrelated diff in the pull request diff.
  // To avoid that issue, recreate a merge commit by base into head strategy.
  // https://github.com/int128/update-generated-files-action/issues/351
  core.info(`Re-merging base branch into head branch`)
  await git.checkout(headSHA)
  await git.merge(
    baseSHA,
    `Merge branch '${baseRef}' into ${headRef}

Updated the head branch since the current workflow is running on the merge commit.
${inputs.commitMessageFooter}`,
  )
  await git.tryCherryPick(workspaceChangeSHA)
  core.info(`Updating the head branch ${headRef}`)
  await git.showGraph()
  await git.push({ ref: `refs/heads/${headRef}`, token: inputs.token })
}
