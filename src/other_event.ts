import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { Inputs } from './run'
import { Context } from '@actions/github/lib/context'

export type PartialContext = Pick<
  Context,
  'ref' | 'workflow' | 'job' | 'runId' | 'serverUrl' | 'repo' | 'actor' | 'sha' | 'runNumber' | 'eventName'
>

export const handleOtherEvent = async (inputs: Inputs, context: PartialContext) => {
  const octokit = github.getOctokit(inputs.token)
  const head = `update-generated-files-${context.sha}-${context.runNumber}`
  core.info(`Creating a head branch ${head}`)
  await git.createBranch({
    branch: head,
    commitMessage: commitMessage(inputs.title, context),
    token: inputs.token,
  })

  const body = `Hi @${context.actor},

${inputs.body}

----

Generated by [GitHub Actions (${context.workflow} / ${context.job})](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})
`

  const [, , base] = context.ref.split('/')
  core.info(`Creating a pull request for ${base} branch`)
  const { data: pull } = await octokit.rest.pulls.create({
    ...context.repo,
    base,
    head,
    title: inputs.title,
    body,
  })
  core.info(`Created ${pull.html_url}`)
  core.summary.addHeading(`Created a pull request: ${inputs.title}`)
  core.summary.addLink(`${pull.base.repo.full_name}#${pull.number}`, pull.html_url)
  await core.summary.write()

  core.info(`Requesting a review to ${context.actor}`)
  try {
    await octokit.rest.pulls.requestReviewers({
      ...context.repo,
      pull_number: pull.number,
      reviewers: [context.actor],
    })
  } catch (e) {
    core.info(`could not request a review to ${context.actor}: ${String(e)}`)
  }

  core.info(`Adding ${context.actor} to assignees`)
  try {
    await octokit.rest.issues.addAssignees({
      ...context.repo,
      issue_number: pull.number,
      assignees: [context.actor],
    })
  } catch (e) {
    core.info(`could not assign ${context.actor}: ${String(e)}`)
  }

  if (context.eventName === 'push') {
    // fail if the ref is outdated
    throw new Error(`Please merge ${pull.html_url} to follow up the generated files`)
  }
}

const commitMessage = (
  title: string,
  context: PartialContext
) => `Generated by GitHub Actions (${context.workflow} / ${context.job})

${title}
${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
