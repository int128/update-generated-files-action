import * as core from '@actions/core'
import * as git from './git.js'
import * as github from '@actions/github'
import { PullRequestContext, handlePullRequestEvent } from './pull_request_event.js'
import { handleOtherEvent } from './other_event.js'

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

export const run = async (inputs: Inputs): Promise<Outputs> => {
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return {}
  }

  await git.configureAuthor()

  if (github.context.eventName === 'pull_request') {
    return await handlePullRequestEvent(inputs, github.context as PullRequestContext)
  }
  return await handleOtherEvent(inputs, github.context)
}
