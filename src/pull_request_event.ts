import * as core from '@actions/core'
import * as git from './git'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'

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



export const handlePullRequestEvent = async (inputs: Inputs, context: PullRequestContext) => {
  if (context.payload.pull_request === undefined) {
    throw new Error(`context.payload.pull_request is undefined`)
  }
  await git.stash()

  const currentSHA = await git.getCurrentSHA()
  if (currentSHA === context.sha) {
    core.info(`Re-merging base branch into head branch`)
    await remerge(currentSHA, inputs, context)
  }

  const headRef = context.payload.pull_request.head.ref
  core.info(`Updating the head branch ${headRef}`)
  await git.stashPop()
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

const remerge = async (currentSHA: string, inputs: Inputs, context: PullRequestContext) => {
  if (context.payload.pull_request === undefined) {
    throw new Error(`context.payload.pull_request is undefined`)
  }

  const parents = await git.getParents(currentSHA)
  const headSHA = context.payload.pull_request.head.sha
  const baseSHA = parents.filter((sha) => sha != headSHA).pop()
  if (baseSHA === undefined) {
    core.warning(`Could not determine base commit from parents ${String(parents)}`)
    return
  }
  const headRef = context.payload.pull_request.head.ref
  const baseRef = context.payload.pull_request.base.ref
  core.info(`head: ${headSHA} ${headRef}`)
  core.info(`base: ${baseSHA} ${baseRef}`)

  for (let depth = 50; depth < 1000; depth += 50) {
    await git.showGraph()
    if (await git.canMerge(baseSHA, headSHA)) {
      break
    }
    core.info(`Fetching more commits (depth ${depth})`)
    await git.fetch({ refs: [baseSHA, headSHA], depth, token: inputs.token })
  }
  await git.checkout(headSHA)

  await git.merge(baseSHA, `Merge ${baseRef} ${baseSHA} into ${headRef} ${headSHA}

Recreated a merge commit from ${currentSHA}
${inputs.commitMessageFooter}`)
}
