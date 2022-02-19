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

  await exec.exec('git', ['config', 'user.name', github.context.actor])
  await exec.exec('git', ['config', 'user.email', `${github.context.actor}@users.noreply.github.com`])

  if (github.context.eventName !== 'pull_request') {
    core.info(`Creating a pull request to follow up the difference`)
    const octokit = github.getOctokit(inputs.token)
    await createFollowUpPullRequest(octokit)
    throw new Error(`${github.context.ref} is broken because there is difference between source and generated files`)
  }

  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', 'Fix inconsistency between source and generated files'])
  await exec.exec('git', ['push'])

  const headOutput = await exec.getExecOutput('git', ['rev-parse', 'HEAD'])
  const headSHA = headOutput.stdout.trim()
  core.info(`head SHA is ${headSHA}`)
  core.setOutput('updated-sha', headSHA)
}

const createFollowUpPullRequest = async (octokit: Octokit) => {
  const [, , base] = github.context.ref.split('/')
  const head = `update-generated-files-${github.context.sha}-${github.context.runNumber}`
  const body = `Hi @${github.context.actor},

${base} branch is inconsistency,
because there is difference between source and generated files at ${github.context.sha}.
This pull request will fix the inconsistency.
`

  await exec.exec('git', ['checkout', '-b', head])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', 'Fix inconsistency between source and generated files'])
  await exec.exec('git', ['push', 'origin', head])

  const { data: pull } = await octokit.rest.pulls.create({
    ...github.context.repo,
    base,
    head,
    title: `Fix inconsistency of ${base} branch`,
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
