import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'
import { RequestError } from '@octokit/request-error'

export type PartialContext = Pick<Context, 'ref' | 'repo' | 'actor' | 'sha' | 'runNumber' | 'eventName'>

export const handleOtherEvent = async (inputs: Inputs, context: PartialContext) => {
  const octokit = github.getOctokit(inputs.token)

  if (!context.ref.startsWith('refs/heads/')) {
    core.warning('This action handles only branch event')
    return
  }

  const head = `update-generated-files-${context.sha}-${context.runNumber}`
  core.info(`Creating a new branch ${head}`)
  await git.commit(`${inputs.commitMessage}\n\n${inputs.commitMessageFooter}`)
  await git.push({ ref: `refs/heads/${head}`, token: inputs.token })

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
  core.summary.addHeading(`Created a pull request: ${inputs.title}`)
  core.summary.addLink(`${pull.base.repo.full_name}#${pull.number}`, pull.html_url)
  await core.summary.write()

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

  if (context.eventName === 'push') {
    // fail if the ref is outdated
    throw new Error(`Please merge ${pull.html_url} to follow up the generated files`)
  }
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
