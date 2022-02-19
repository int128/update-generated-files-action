import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    comitterName: core.getInput('committer-name', { required: true }),
    comitterEmail: core.getInput('committer-email', { required: true }),
    message: core.getInput('message', { required: true }),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : JSON.stringify(e)))
