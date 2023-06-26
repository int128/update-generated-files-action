import * as core from '@actions/core'
import * as git from './git'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'

const LIMIT_REPEATED_COMMITS = 5

export type PullRequestContext = Pick<Context, 'sha'> & {
  payload: Pick<WebhookPayload, 'action'> & {
    pull_request?: {
      base: {
        ref: string
      }
      head: {
        sha: string
        ref: string
      }
    }
  }
}

type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  token: string
}

export const handlePullRequestEvent = async (inputs: Inputs, context: PullRequestContext) => {
  if (context.payload.pull_request === undefined) {
    throw new Error(`context.payload.pull_request is undefined`)
  }

  const headSHA = context.payload.pull_request.head.sha
  await git.fetch({ refs: [headSHA], depth: LIMIT_REPEATED_COMMITS, token: inputs.token })
  const lastAuthorNames = await git.getAuthorNameOfCommits(headSHA, LIMIT_REPEATED_COMMITS)
  if (lastAuthorNames.every((authorName) => authorName == git.AUTHOR_NAME)) {
    throw new Error(
      `This action has been called ${LIMIT_REPEATED_COMMITS} times. Stop the job to prevent infinite loop.`,
    )
  }

  const currentSHA = await git.getCurrentSHA()
  if (currentSHA === context.sha) {
    // If this action pushes the merge commit (refs/pull/x/merge) into the head branch,
    // we may see the unrelated diff in the pull request diff.
    // To avoid that issue, recreate a merge commit by base into head strategy.
    // https://github.com/int128/update-generated-files-action/issues/351
    core.info(`Re-merging base branch into head branch`)
    await git.stash()
    await recreateMergeCommit(currentSHA, inputs, context)
    await git.stashPop()
  }

  const headRef = context.payload.pull_request.head.ref
  core.info(`Updating the head branch ${headRef}`)
  await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
  await git.showGraph()
  await git.push({ ref: `refs/heads/${headRef}`, token: inputs.token })

  core.summary.addRaw(`Added a commit. CI should pass on the new commit.`)
  await core.summary.write()

  if (context.payload.action === 'opened' || context.payload.action === 'synchronize') {
    // fail if the head ref is outdated
    throw new Error(`Added a commit. CI should pass on the new commit.`)
  }
  return
}

const recreateMergeCommit = async (currentSHA: string, inputs: Inputs, context: PullRequestContext) => {
  if (context.payload.pull_request === undefined) {
    throw new Error(`context.payload.pull_request is undefined`)
  }

  const parentSHAs = await git.getParentSHAs(currentSHA)
  const headSHA = context.payload.pull_request.head.sha
  const baseSHA = parentSHAs.filter((sha) => sha != headSHA).pop()
  if (baseSHA === undefined) {
    core.warning(`Could not determine base commit from parents ${String(parentSHAs)}`)
    return
  }
  const headRef = context.payload.pull_request.head.ref
  const baseRef = context.payload.pull_request.base.ref
  core.info(`head: ${headSHA} ${headRef}`)
  core.info(`base: ${baseSHA} ${baseRef}`)

  for (let depth = 50; depth < 1000; depth += 50) {
    core.info(`Fetching more commits (depth ${depth})`)
    await git.fetch({ refs: [baseSHA, headSHA], depth, token: inputs.token })
    if (await git.canMerge(baseSHA, headSHA)) {
      break
    }
  }

  await git.showGraph()
  await git.checkout(headSHA)
  await git.merge(
    baseSHA,
    `Merge branch ${baseRef} ${baseSHA} into ${headRef} ${headSHA}

Recreated a merge commit from ${currentSHA} by GitHub Actions
${inputs.commitMessageFooter}`,
  )
}
