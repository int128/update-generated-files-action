import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'
import { RequestError } from '@octokit/request-error'

const LIMIT_REPEATED_COMMITS = 5

export type PartialContext = Pick<Context, 'ref' | 'repo' | 'actor' | 'sha' | 'runNumber' | 'eventName'>

export const handleOtherEvent = async (inputs: Inputs, context: PartialContext) => {
  if (!context.ref.startsWith('refs/heads/')) {
    core.warning('This action handles only branch event')
    return
  }

  await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
  // do not change the current HEAD from here

  core.info(`Trying to update ${context.ref} by fast-forward`)
  if (await updateRefByFastForward(inputs, context)) {
    core.summary.addHeading(`GitHub Actions automatically updated the generated files in ${context.ref}`)
    await core.summary.write()
    if (context.eventName === 'push') {
      throw new Error(`GitHub Actions automatically updated the generated files in ${context.ref}`)
    }
    return
  }

  core.info(`Falling back to create a pull request to follow up`)
  const pullUrl = await createPull(inputs, context)
  core.summary.addHeading(`Created a pull request: ${inputs.title}`)
  core.summary.addLink(pullUrl, pullUrl)
  await core.summary.write()
  if (context.eventName === 'push') {
    throw new Error(`Please merge ${pullUrl} to follow up the generated files`)
  }
}

const updateRefByFastForward = async (inputs: Inputs, context: PartialContext): Promise<boolean> => {
  core.info(`Checking the last commits to prevent infinite loop`)
  await git.fetch({ refs: [context.sha], depth: LIMIT_REPEATED_COMMITS, token: inputs.token })
  const lastAuthorNames = await git.getAuthorNameOfCommits(context.sha, LIMIT_REPEATED_COMMITS)
  if (lastAuthorNames.every((authorName) => authorName == git.AUTHOR_NAME)) {
    core.error(`This action has been called ${lastAuthorNames.length} times. Do not push to prevent infinite loop`)
    return false
  }

  const code = await git.push({ ref: context.ref, token: inputs.token, ignoreReturnCode: true })
  if (code !== 0) {
    core.info(`Failed to update ${context.ref} by fast-forward: git returned code ${code}`)
    return false
  }
  core.info(`Updated ${context.ref} by fast-forward`)
  return true
}

const createPull = async (inputs: Inputs, context: PartialContext): Promise<string> => {
  const head = `update-generated-files-${context.sha}-${context.runNumber}`
  core.info(`Creating a new branch ${head}`)
  await git.push({ ref: `refs/heads/${head}`, token: inputs.token })

  const octokit = github.getOctokit(inputs.token)
  const base = context.ref.replace(/^refs\/heads\//, '')
  core.info(`Creating a pull request for ${base} branch`)
  const { data: pull } = await octokit.rest.pulls.create({
    ...context.repo,
    base,
    head,
    title: inputs.title,
    body: `${inputs.body}\n\n----\n\n${inputs.commitMessage}\n${inputs.commitMessageFooter}`,
  })
  core.info(`Created ${pull.html_url}`)

  if (inputs.reviewers) {
    const r = splitReviewers(inputs.reviewers)
    core.info(`Requesting a review to ${JSON.stringify(r)}`)
    await catchRequestError(
      () =>
        octokit.rest.pulls.requestReviewers({
          ...context.repo,
          pull_number: pull.number,
          reviewers: r.users,
          team_reviewers: r.teams,
        }),
      (e) => core.info(`could not request a review to ${context.actor}: ${String(e)}`),
    )
  }

  core.info(`Requesting a review to the actor @${context.actor}`)
  await catchRequestError(
    () =>
      octokit.rest.pulls.requestReviewers({
        ...context.repo,
        pull_number: pull.number,
        reviewers: [context.actor],
      }),
    (e) => core.info(`could not request a review to ${context.actor}: ${String(e)}`),
  )

  core.info(`Adding the actor @${context.actor} to assignees`)
  await catchRequestError(
    () =>
      octokit.rest.issues.addAssignees({
        ...context.repo,
        issue_number: pull.number,
        assignees: [context.actor],
      }),
    (e) => core.info(`could not assign ${context.actor}: ${String(e)}`),
  )

  return pull.html_url
}

const splitReviewers = (reviewers: string[]) => ({
  users: reviewers.filter((reviewer) => !reviewer.includes('/')),
  teams: reviewers.filter((reviewer) => reviewer.includes('/')).map((reviewer) => reviewer.split('/')[1]),
})

const catchRequestError = async <T, U>(f: () => Promise<T>, g: (error: RequestError) => U): Promise<T | U> => {
  try {
    return await f()
  } catch (error: unknown) {
    if (error instanceof RequestError) {
      return g(error)
    }
    throw error
  }
}
