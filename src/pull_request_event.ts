import * as core from '@actions/core'
import * as git from './git'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'

export type PullRequestContext = Pick<Context, 'sha'> & {
  payload: Pick<WebhookPayload, 'action'> & {
    pull_request?: {
      base: {
        sha: string
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
  await git.showGraph()

  const currentSHA = await git.getCurrentSHA()
  if (currentSHA === context.sha) {
    const base = context.payload.pull_request.base.sha
    const head = context.payload.pull_request.head.sha
    core.info(`Re-merging base branch into head branch`)
    core.info(`base: ${base}`)
    core.info(`head: ${head}`)
    for (let depth = 50; depth < 1000; depth += 50) {
      if (await git.canMerge(base, head)) {
        break
      }
      core.info(`Fetching more commits (depth ${depth})`)
      await git.showGraph()
      await git.fetch({ refs: [base, head], depth, token: inputs.token })
    }
    await git.checkout(head)
    await git.merge(base)
  }

  const head = context.payload.pull_request.head.ref
  core.info(`Updating the head branch ${head}`)
  await git.stashPop()
  await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
  await git.push({ ref: `refs/heads/${head}`, token: inputs.token })



  
  core.summary.addRaw(`Added a commit. CI should pass on the new commit.`)
  await core.summary.write()

  if (context.payload.action === 'opened' || context.payload.action === 'synchronize') {
    // fail if the head ref is outdated
    throw new Error(`Added a commit. CI should pass on the new commit.`)
  }
  return
}
