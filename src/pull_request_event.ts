import * as core from '@actions/core'
import * as git from './git'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'

export type PullRequestContext = Pick<Context, 'ref'> & {
  payload: Pick<WebhookPayload, 'action'> & {
    pull_request?: {
      head: {
        ref: string
      }
    }
  }
}

export const handlePullRequestEvent = async (inputs: Inputs, context: PullRequestContext) => {
  if (context.payload.pull_request === undefined) {
    throw new Error(`context.payload.pull_request is undefined`)
  }
  const head = context.payload.pull_request.head.ref

  core.info(`Updating the head branch ${head}`)
  await git.fetchBranch({ ref: context.ref, depth: 2, token: inputs.token })
  await git.updateBranch({
    ref: `refs/heads/${head}`,
    commitMessage: `${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`,
    token: inputs.token,
  })

  core.summary.addRaw(`Added a commit. CI should pass on the new commit.`)
  await core.summary.write()

  if (context.payload.action === 'opened' || context.payload.action === 'synchronize') {
    // fail if the head ref is outdated
    throw new Error(`Added a commit. CI should pass on the new commit.`)
  }
  return
}
