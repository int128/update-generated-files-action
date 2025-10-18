import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import * as git from './git.js'
import { type Context, contextIsPullRequestEvent } from './github.js'
import { handleOtherEvent } from './other_event.js'
import { handlePullRequestEvent } from './pull_request_event.js'

export type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  headBranch: string
  title: string
  body: string
  draft: boolean
  reviewers: string[]
  labels: string[]
  token: string
}

export type Outputs = {
  // If both value and error are returned, this field is set.
  error?: Error

  pullRequestUrl?: string
  pullRequestNumber?: number
}

export const run = async (inputs: Inputs, context: Context, octokit: Octokit): Promise<Outputs> => {
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return {}
  }

  await git.configureAuthor()

  if (contextIsPullRequestEvent(context)) {
    return await handlePullRequestEvent(inputs, context)
  }

  return await handleOtherEvent(inputs, context, octokit)
}
