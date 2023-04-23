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
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return
  }

  await git.configureAuthor()

  if (github.context.eventName === 'pull_request') {
    return await handlePullRequestEvent(inputs, github.context as PullRequestContext)
  }
  await handleOtherEvent(inputs, github.context)
}
