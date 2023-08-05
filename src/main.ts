import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    commitMessage: core.getInput('commit-message', { required: true }),
    commitMessageFooter: core.getInput('commit-message-footer', { required: true }),
    title: core.getInput('title', { required: true }),
    body: core.getInput('body', { required: true }),
    reviewers: core.getMultilineInput('reviewers'),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
