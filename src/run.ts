import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { PullRequestContext, handlePullRequestEvent } from './pull_request_event'
import { handleOtherEvent } from './other_event'

const authorName = 'update-generated-files-action'
const authorEmail = '41898282+github-actions[bot]@users.noreply.github.com'

export type Inputs = {
  title: string
  body: string
  dispatchWorkflows: string[]
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return
  }

  await git.setConfigUser(authorName, authorEmail)

  if (github.context.eventName === 'pull_request') {
    return await handlePullRequestEvent(inputs, github.context as PullRequestContext)
  }
  await handleOtherEvent(inputs, github.context)
}


