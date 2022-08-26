import * as core from '@actions/core'
import * as git from './git'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

const authorName = 'update-generated-files-action'

type Inputs = {
  title: string
  body: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if ((await git.status()) === '') {
    core.info('Nothing to commit')
    return
  }

  const lastAuthor = await git.getLastAuthorFromLog()
  if (lastAuthor == authorName) {
    throw new Error(`Author of the last commit was ${lastAuthor}. Stop to prevent infinite loop`)
  }

  await git.setConfigUser(authorName, '41898282+github-actions[bot]@users.noreply.github.com')

  if (github.context.eventName === 'pull_request') {
    core.info(`Updating the current branch`)
    await git.updateCurrentBranch(inputs.title)
    throw new Error(`Inconsistent generated files in pull request`)
  }

  const octokit = github.getOctokit(inputs.token)
  await createPullRequest(octokit, inputs)
  throw new Error(`Inconsistent generated files in ${github.context.ref}`)
}

const createPullRequest = async (octokit: Octokit, inputs: Pick<Inputs, 'title' | 'body'>) => {
  const [, , base] = github.context.ref.split('/')
  core.info(`Creating a pull request for ${base} branch`)

  const head = `update-generated-files-${github.context.sha}-${github.context.runNumber}`
  const body = `Hi @${github.context.actor},

${inputs.body}

----

Created by [GitHub Actions](${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}) at ${github.context.ref}.
`

  core.info(`Creating a branch ${head}`)
  await git.createBranch(head, inputs.title)

  const { data: pull } = await octokit.rest.pulls.create({
    ...github.context.repo,
    base,
    head,
    title: inputs.title,
    body,
  })
  core.info(`Created ${pull.html_url}`)

  core.info(`Requesting a review to ${github.context.actor}`)
  try {
    await octokit.rest.pulls.requestReviewers({
      ...github.context.repo,
      pull_number: pull.number,
      reviewers: [github.context.actor],
    })
  } catch (e) {
    core.warning(`could not request a review to ${github.context.actor}: ${String(e)}`)
  }

  core.info(`Adding ${github.context.actor} to assignees`)
  try {
    await octokit.rest.issues.addAssignees({
      ...github.context.repo,
      issue_number: pull.number,
      assignees: [github.context.actor],
    })
  } catch (e) {
    core.warning(`could not assign ${github.context.actor}: ${String(e)}`)
  }
}
