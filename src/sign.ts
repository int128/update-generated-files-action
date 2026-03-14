import type { Octokit } from '@octokit/action'
import * as git from './git.js'
import type { Context } from './github.js'

export const signCurrentCommit = async (context: Context, octokit: Octokit) => {
  const unsignedCommitSHA = await git.getCurrentSHA()
  const signingBranch = `signing--${unsignedCommitSHA}`
  await git.push({ localRef: unsignedCommitSHA, remoteRef: `refs/heads/${signingBranch}`, dryRun: false }, context)
  try {
    const { data: unsignedCommit } = await octokit.rest.git.getCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      commit_sha: unsignedCommitSHA,
    })
    const { data: signedCommit } = await octokit.rest.git.createCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      message: unsignedCommit.message,
      tree: unsignedCommit.tree.sha,
      parents: unsignedCommit.parents.map((parent) => parent.sha),
    })
    await octokit.rest.git.updateRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `heads/${signingBranch}`,
      sha: signedCommit.sha,
      force: true,
    })
    await git.fetch({ refs: [signedCommit.sha], depth: 1 }, context)
    await git.checkout(signedCommit.sha)
  } finally {
    await git.deleteRef(`refs/heads/${signingBranch}`, context)
  }
}
