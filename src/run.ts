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

  await git.setConfigUser(authorName, '41898282+github-actions[bot]@users.noreply.github.com')

  if (github.context.eventName === 'pull_request') {
    core.info(`Updating the current branch`)
    await git.updateCurrentBranch({ commitMessage: inputs.title, token: inputs.token })

    // the head ref is outdated,
    if (github.context.payload.action === 'opened' || github.context.payload.action === 'synchronize') {
      throw new Error(
        `GitHub Actions automatically added a commit to the pull request. CI should pass on the new commit.`
      )
    }
    return
  }

  const octokit = github.getOctokit(inputs.token)
  const pullRequestURL = await createPullRequest(octokit, inputs)
  throw new Error(
    `You may need to fix the generated files in ${github.context.ref}. Review the pull request: ${pullRequestURL}`
  )
}

const createPullRequest = async (octokit: Octokit, inputs: Inputs) => {
  const [, , base] = github.context.ref.split('/')
  core.info(`Creating a pull request for ${base} branch`)

  const head = `update-generated-files-${github.context.sha}-${github.context.runNumber}`
  const body = `Hi @${github.context.actor},

${inputs.body}

----

Created by [GitHub Actions](${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}) at ${github.context.ref}.
`

  core.info(`Creating a branch ${head}`)
  await git.createBranch({ branch: head, commitMessage: inputs.title, token: inputs.token })

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
    core.info(`could not request a review to ${github.context.actor}: ${String(e)}`)
  }

  core.info(`Adding ${github.context.actor} to assignees`)
  try {
    await octokit.rest.issues.addAssignees({
      ...github.context.repo,
      issue_number: pull.number,
      assignees: [github.context.actor],
    })
  } catch (e) {
    core.info(`could not assign ${github.context.actor}: ${String(e)}`)
  }

  return pull.html_url
}
