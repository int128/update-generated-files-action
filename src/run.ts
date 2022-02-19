import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

type Inputs = {
  comitterName: string
  comitterEmail: string
  message: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  if ((await gitStatus()) === '') {
    core.info('Nothing to commit')
    return
  }

  await exec.exec('git', ['config', 'user.name',
   inputs.comitterName])
  await exec.exec('git', ['config', 'user.email', inputs.comitterEmail])

  if (github.context.eventName !== 'pull_request') {
    core.info(`Creating a pull request to follow up the difference`)
    await createFollowUpPullRequest(inputs)
    throw new Error(`${github.context.ref} is broken because there is difference between source and generated files`)
  }

  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', inputs.message])
  await exec.exec('git', ['push', 'origin'])
}

const createFollowUpPullRequest = async (inputs: Inputs) => {
  const [, , base] = github.context.ref.split('/')
  const head = `update-generated-files-${github.context.sha}-${github.context.runNumber}`
  const body = `Hi ${github.context.actor},
${base} branch is broken because there is difference between source and generated files at ${github.context.sha}.
This pull request will fix the difference.
`

  await exec.exec('git', ['checkout', '-b', head])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', inputs.message])
  await exec.exec('git', ['push', 'origin', head])

  const octokit = github.getOctokit(inputs.token)
  const { data: pull } = await octokit.rest.pulls.create({
    ...github.context.repo,
    base,
    head,
    title: 'Update generated files',
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
