import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'

export type AutoMerge = {
  mergeMethod: 'MERGE' | 'SQUASH' | 'REBASE'
}

export const parseAutoMerge = (enable: boolean, mergeMethodInput: string): AutoMerge | undefined => {
  if (!enable) {
    return
  }
  const mergeMethod = mergeMethodInput.toUpperCase()
  if (mergeMethod !== 'MERGE' && mergeMethod !== 'SQUASH' && mergeMethod !== 'REBASE') {
    throw new Error(`auto-merge-method must be one of merge, squash or rebase`)
  }
  return { mergeMethod }
}

type PullRequest = {
  html_url: string
  node_id: string
}

export const enableAutoMerge = async (autoMerge: AutoMerge, pull: PullRequest, octokit: Octokit) => {
  core.info(`Enabling auto-merge (${autoMerge.mergeMethod}) on ${pull.html_url}`)
  const response = await catchGraphqlError(() =>
    octokit.graphql(
      `mutation enablePullRequestAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
          clientMutationId
        }
      }`,
      { pullRequestId: pull.node_id, mergeMethod: autoMerge.mergeMethod },
    ),
  )
  if (response instanceof Error) {
    core.warning(`Could not enable auto-merge on ${pull.html_url}: ${String(response)}`)
  }
}

const catchGraphqlError = async <T>(f: () => Promise<T>): Promise<T | Error> => {
  try {
    return await f()
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'GraphqlResponseError') {
      return error
    }
    if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
      return error
    }
    throw error
  }
}
