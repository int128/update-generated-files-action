import * as core from '@actions/core'
import * as git from './git.js'

const LIMIT_REPEATED_COMMITS = 5

export const GENERATED_BY_TRAILER = 'Generated-by: update-generated-files-action'

export const failIfInfiniteLoopDetected = async (headSHA: string) =>
  core.group(`Checking the last commits to detect an infinite loop`, async () => {
    await git.fetch({ refs: [headSHA], depth: LIMIT_REPEATED_COMMITS })
    const lastCommitMessages = await git.getCommitMessages(headSHA, LIMIT_REPEATED_COMMITS)
    if (lastCommitMessages.every((message) => message.includes(GENERATED_BY_TRAILER))) {
      throw new Error(`This action has been called ${LIMIT_REPEATED_COMMITS} times. Stop to prevent an infinite loop.`)
    }
  })
