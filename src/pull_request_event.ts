import assert from 'node:assert'
import * as core from '@actions/core'
import type { PullRequestEvent } from '@octokit/webhooks-types'
import * as git from './git.js'
import type { Context } from './github.js'
import type { Outputs } from './run.js'

const LIMIT_REPEATED_COMMITS = 5

export type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  dryRun: boolean
}

export const handlePullRequestEvent = async (inputs: Inputs, context: Context<PullRequestEvent>): Promise<Outputs> => {
  const headSHA = context.payload.pull_request.head.sha
  await git.fetch({ refs: [headSHA], depth: LIMIT_REPEATED_COMMITS })
  const lastAuthorNames = await git.getAuthorNameOfCommits(headSHA, LIMIT_REPEATED_COMMITS)
  if (lastAuthorNames.every((authorName) => authorName === git.AUTHOR_NAME)) {
    throw new Error(
      `This action has been called ${LIMIT_REPEATED_COMMITS} times. Stop the job to prevent infinite loop.`,
    )
  }

  if (await currentCommitIsMergeCommit(context)) {
    await cherryPickWorkspaceChangesOntoMergeCommit(inputs, context)
  } else {
    core.info(`Committing the workspace changes on the head branch directly`)
    await git.commit(inputs.commitMessage, [inputs.commitMessageFooter])
  }
  await git.showGraph()

  const headRef = context.payload.pull_request.head.ref
  core.info(`Updating the head branch ${headRef}`)
  if (inputs.dryRun) {
    core.warning(`[dry-run] git push ${headRef}`)
    return {}
  }
  await git.push({ ref: `refs/heads/${headRef}` })

  if (context.payload.action === 'opened' || context.payload.action === 'synchronize') {
    // Fail if the head ref is outdated
    core.summary.addRaw(`Added a commit. CI should pass on the new commit.`)
    await core.summary.write()
    throw new Error(`Added a commit. CI should pass on the new commit.`)
  }
  return {}
}

const currentCommitIsMergeCommit = async (context: Context<PullRequestEvent>): Promise<boolean> =>
  (await git.getCurrentSHA()) === context.sha

const cherryPickWorkspaceChangesOntoMergeCommit = async (inputs: Inputs, context: Context<PullRequestEvent>) => {
  core.info(`Cherry-pick the workspace changes onto the merge commit`)
  await git.commit(inputs.commitMessage, [inputs.commitMessageFooter])
  const workspaceChangeSHA = await git.getCurrentSHA()

  const parentSHAs = await git.getParentSHAs(context.sha)
  const headSHA = context.payload.pull_request.head.sha
  const baseSHA = parentSHAs.filter((sha) => sha !== headSHA).pop()
  assert(baseSHA !== undefined, `context.sha ${context.sha} must be a merge commit`)
  await fetchCommitsBetweenBaseHead(baseSHA, headSHA)

  await git.checkout(headSHA)
  if (await git.tryCherryPick(workspaceChangeSHA)) {
    return
  }

  // If this action pushes the merge commit (refs/pull/x/merge) into the head branch,
  // we may see the unrelated diff in the pull request diff.
  // To avoid that issue, recreate a merge commit by base into head strategy.
  // https://github.com/int128/update-generated-files-action/issues/351
  core.info(`Re-merging base branch into head branch`)
  await git.checkout(headSHA)
  const headRef = context.payload.pull_request.head.ref
  const baseRef = context.payload.pull_request.base.ref
  await git.merge(baseSHA, `Merge branch '${baseRef}' into ${headRef}`)
  await git.cherryPick(workspaceChangeSHA)
}

const fetchCommitsBetweenBaseHead = async (baseSHA: string, headSHA: string) => {
  for (let depth = 50; depth < 1000; depth += 50) {
    if (await git.canMerge(baseSHA, headSHA)) {
      core.info(`Fetched commits required to merge base and head`)
      return
    }
    await git.fetch({ refs: [baseSHA, headSHA], depth })
  }
}
