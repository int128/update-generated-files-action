import * as core from '@actions/core'
import { run } from './run.js'

const main = async (): Promise<void> => {
  const outputs = await run({
    commitMessage: core.getInput('commit-message', { required: true }),
    commitMessageFooter: core.getInput('commit-message-footer', { required: true }),
    headBranch: core.getInput('head-branch', { required: true }),
    title: core.getInput('title', { required: true }),
    body: core.getInput('body', { required: true }),
    draft: core.getBooleanInput('draft', { required: true }),
    reviewers: core.getMultilineInput('reviewers'),
    labels: core.getMultilineInput('labels'),
    token: core.getInput('token', { required: true }),
  })
  if (outputs.pullRequestUrl) {
    core.setOutput('pull-request-url', outputs.pullRequestUrl)
  }
  if (outputs.pullRequestNumber) {
    core.setOutput('pull-request-number', outputs.pullRequestNumber)
  }
  if (outputs.error) {
    throw outputs.error
  }
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
