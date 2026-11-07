import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import type { AutoMerge } from './auto_merge.js'
import * as git from './git.js'
import { type Context, contextIsPullRequestEvent } from './github.js'
import { handleOtherEvent } from './other_event.js'
import { handlePullRequestEvent } from './pull_request_event.js'

export type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  headBranchPrefix: string
  headBranchKeys: string[]
  title: string
  body: string
  draft: boolean
  reviewers: string[]
  labels: string[]
  autoMerge: AutoMerge | undefined
  dryRun: boolean
}

export type Outputs = {
  // If both value and error are returned, this field is set.
  error?: Error

  pullRequestUrl?: string
  pullRequestId?: string
  pullRequestNumber?: number
}

export const run = async (inputs: Inputs, context: Context, octokit: Octokit): Promise<Outputs> => {
  if (inputs.draft && inputs.autoMerge) {
    throw new Error('draft and enable-auto-merge cannot be set at the same time')
  }
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return {}
  }
  if (contextIsPullRequestEvent(context)) {
    return await handlePullRequestEvent(inputs, context, octokit)
  }
  return await handleOtherEvent(inputs, context, octokit)
}
