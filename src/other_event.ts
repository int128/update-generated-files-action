import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import * as git from './git.js'
import type { Context } from './github.js'
import type { Inputs, Outputs } from './run.js'

const LIMIT_REPEATED_COMMITS = 5

export const handleOtherEvent = async (inputs: Inputs, context: Context, octokit: Octokit): Promise<Outputs> => {
  if (!context.ref.startsWith('refs/heads/')) {
    core.warning('This action handles only branch event')
    return {}
  }

  await git.commit(inputs.commitMessage, [inputs.commitMessageFooter])
  // do not change the current HEAD from here

  core.info(`Trying to update ${context.ref} by fast-forward`)
  if (await updateRefByFastForward(inputs, context)) {
    core.summary.addHeading(`GitHub Actions automatically updated the generated files in ${context.ref}`)
    await core.summary.write()
    if (inputs.dryRun) {
      core.warning(`[dry-run] GitHub Actions automatically updated the generated files in ${context.ref}`)
      return {}
    }
    if (context.eventName === 'push') {
      throw new Error(`GitHub Actions automatically updated the generated files in ${context.ref}`)
    }
    return {}
  }

  core.info(`Falling back to create a pull request to follow up`)
  const pull = await createPull(inputs, context, octokit)
  core.summary.addHeading(`Created a pull request: ${inputs.title}`)
  core.summary.addLink(pull.html_url, pull.html_url)
  await core.summary.write()

  return {
    error:
      context.eventName === 'push'
        ? new Error(`Please merge ${pull.html_url} to follow up the generated files`)
        : undefined,
    pullRequestUrl: pull.html_url,
    pullRequestNumber: pull.number,
  }
}

const updateRefByFastForward = async (inputs: Inputs, context: Context): Promise<boolean> => {
  core.info(`Checking the last commits to prevent infinite loop`)
  await git.fetch({ refs: [context.sha], depth: LIMIT_REPEATED_COMMITS })
  const lastAuthorNames = await git.getAuthorNameOfCommits(context.sha, LIMIT_REPEATED_COMMITS)
  if (lastAuthorNames.every((authorName) => authorName === git.AUTHOR_NAME)) {
    core.error(`This action has been called ${lastAuthorNames.length} times. Do not push to prevent infinite loop`)
    return false
  }

  const code = await git.push(
    { localRef: `HEAD`, remoteRef: context.ref, dryRun: inputs.dryRun },
    { ignoreReturnCode: true },
  )
  if (code !== 0) {
    core.info(`Failed to update ${context.ref} by fast-forward: git returned code ${code}`)
    return false
  }
  core.info(`Updated ${context.ref} by fast-forward`)
  return true
}

type PullRequest = {
  html_url: string
  number: number
}

const createPull = async (inputs: Inputs, context: Context, octokit: Octokit): Promise<PullRequest> => {
  const head = inputs.headBranch.replaceAll(/[^\w]/g, '-')
  core.info(`Creating a new branch ${head}`)
  await git.push({ localRef: `HEAD`, remoteRef: `refs/heads/${head}`, dryRun: inputs.dryRun })

  const base = context.ref.replace(/^refs\/heads\//, '')
  core.info(`Creating a pull request for ${base} branch`)
  if (inputs.dryRun) {
    core.warning(`[dry-run] Created a pull request`)
    return {
      html_url: `https://example.com/${context.repo.owner}/${context.repo.repo}/pull/-1`,
      number: -1,
    }
  }
  const { data: pull } = await octokit.rest.pulls.create({
    ...context.repo,
    base,
    head,
    title: inputs.title,
    body: `${inputs.body}\n\n----\n\n${inputs.commitMessage}\n${inputs.commitMessageFooter}`,
    draft: inputs.draft,
  })
  core.info(`Created ${pull.html_url}`)

  if (inputs.reviewers.length > 0) {
    const r = splitReviewers(inputs.reviewers)
    core.info(`Requesting a review to ${JSON.stringify(r)}`)
    const requestReviewers = await catchRequestError(() =>
      octokit.rest.pulls.requestReviewers({
        ...context.repo,
        pull_number: pull.number,
        reviewers: r.users,
        team_reviewers: r.teams,
      }),
    )
    if (requestReviewers instanceof Error) {
      core.warning(`Could not request a review to ${JSON.stringify(r)}: ${String(requestReviewers)}`)
      core.info(`Falling back to the actor @${context.actor}`)
      const fallbackRequestReviewers = await catchRequestError(() =>
        octokit.rest.pulls.requestReviewers({
          ...context.repo,
          pull_number: pull.number,
          reviewers: [context.actor],
        }),
      )
      if (fallbackRequestReviewers instanceof Error) {
        core.warning(`Could not request a review to @${context.actor}: ${String(fallbackRequestReviewers)}`)
      }
    }
  } else {
    core.info(`Requesting a review to the actor @${context.actor}`)
    const requestReviewers = await catchRequestError(() =>
      octokit.rest.pulls.requestReviewers({
        ...context.repo,
        pull_number: pull.number,
        reviewers: [context.actor],
      }),
    )
    if (requestReviewers instanceof Error) {
      core.info(`Could not request a review to @${context.actor}: ${String(requestReviewers)}`)
    }

    core.info(`Adding the actor @${context.actor} to assignees`)
    const addAssignees = await catchRequestError(() =>
      octokit.rest.issues.addAssignees({
        ...context.repo,
        issue_number: pull.number,
        assignees: [context.actor],
      }),
    )
    if (addAssignees instanceof Error) {
      core.info(`Could not assign @${context.actor}: ${String(addAssignees)}`)
    }
  }

  if (inputs.labels.length > 0) {
    core.info(`Adding labels ${JSON.stringify(inputs.labels)}`)
    const addLabels = await catchRequestError(() =>
      octokit.rest.issues.addLabels({
        ...context.repo,
        issue_number: pull.number,
        labels: inputs.labels,
      }),
    )
    if (addLabels instanceof Error) {
      core.warning(`Could not add labels to ${pull.number}: ${String(addLabels)}`)
    }
  }

  return pull
}

const splitReviewers = (reviewers: string[]) => ({
  users: reviewers.filter((reviewer) => !reviewer.includes('/')),
  teams: reviewers.filter((reviewer) => reviewer.includes('/')).map((reviewer) => reviewer.split('/')[1]),
})

const catchRequestError = async <T>(f: () => Promise<T>): Promise<T | RequestError> => {
  try {
    return await f()
  } catch (error: unknown) {
    if (isRequestError(error)) {
      return error
    }
    throw error
  }
}

type RequestError = Error & { status: number }

const isRequestError = (error: unknown): error is RequestError =>
  error instanceof Error && 'status' in error && typeof error.status === 'number'
