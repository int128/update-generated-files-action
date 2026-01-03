import * as core from '@actions/core'
import * as git from './git.js'

const LIMIT_REPEATED_COMMITS = 5

export const GENERATED_BY_TRAILER = 'Generated-by: update-generated-files-action'

export const detectRepeatedCommits = async (headSHA: string) =>
  await core.group(`Checking the last ${LIMIT_REPEATED_COMMITS} commits to detect an infinite loop`, async () => {
    await git.fetch({ refs: [headSHA], depth: LIMIT_REPEATED_COMMITS })
    const lastCommitMessages = await git.getCommitMessages(headSHA, LIMIT_REPEATED_COMMITS)
    return (
      lastCommitMessages.length === LIMIT_REPEATED_COMMITS &&
      lastCommitMessages.every((message) => message.includes(GENERATED_BY_TRAILER))
    )
  })
