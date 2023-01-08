import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    title: core.getInput('title', { required: true }),
    body: core.getInput('body', { required: true }),
    dispatchWorkflows: core.getMultilineInput('dispatch-workflows'),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
