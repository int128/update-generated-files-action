import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  await run({
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
