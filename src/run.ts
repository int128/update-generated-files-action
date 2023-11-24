import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { PullRequestContext, handlePullRequestEvent } from './pull_request_event'
import { handleOtherEvent } from './other_event'

export type Inputs = {
  commitMessage: string
  commitMessageFooter: string
  title: string
  body: string
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
