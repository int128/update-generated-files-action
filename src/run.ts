import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'

type Octokit = InstanceType<typeof GitHub>

type Inputs = {
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if ((await gitStatus()) === '') {
    core.info('Nothing to commit')
    return
  }

  await exec.exec('git', ['config', 'user.name', 'github-actions'])
  await exec.exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])

  if (github.context.eventName === 'pull_request') {
    await updateBranch()
    throw new Error(`Inconsistent generated files in pull request`)
  }

  const octokit = github.getOctokit(inputs.token)
  await createPullRequest(octokit)
  throw new Error(`Inconsistent generated files in ${github.context.ref}`)
}

const updateBranch = async () => {
  core.info(`Updating the current branch`)

  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', 'Fix consistency of generated files'])
  await exec.exec('git', ['push'])
}

const createPullRequest = async (octokit: Octokit) => {
  const [, , base] = github.context.ref.split('/')
  core.info(`Creating a pull request for ${base} branch`)

  const head = `update-generated-files-${github.context.sha}-${github.context.runNumber}`
  const body = `Hi @${github.context.actor},

This pull request will fix the consistency of generated files.
See the change for details.

----

Created by [GitHub Actions](${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}) at ${github.context.ref}.
`

  await exec.exec('git', ['checkout', '-b', head])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', 'Fix consistency of generated files'])
  await exec.exec('git', ['push', 'origin', head])

  const { data: pull } = await octokit.rest.pulls.create({
    ...github.context.repo,
    base,
    head,
    title: `Fix consistency of generated files in ${base} branch`,
    body,
  })
  core.info(`Created ${pull.html_url}`)

  core.info(`Requesting a review to ${github.context.actor}`)
  await octokit.rest.pulls.requestReviewers({
    ...github.context.repo,
    pull_number: pull.number,
    reviewers: [github.context.actor],
  })

  core.info(`Adding ${github.context.actor} to assignees`)
  await octokit.rest.issues.addAssignees({
    ...github.context.repo,
    issue_number: pull.number,
    assignees: [github.context.actor],
  })
}

const gitStatus = async (): Promise<string> => {
  const o = await exec.getExecOutput('git', ['status', '--porcelain'])
  return o.stdout.trim()
}
