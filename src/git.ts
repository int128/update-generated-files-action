import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const setConfigUser = async (name: string, email: string) => {
  await exec.exec('git', ['config', 'user.name', name])
  await exec.exec('git', ['config', 'user.email', email])
}

type FetchBranchInput = {
  ref: string
  depth: number
  token: string
}

export const fetchBranch = async (input: FetchBranchInput) => {
  await execWithToken(input.token, ['fetch', `--depth=${input.depth}`, 'origin', input.ref])
}

type UpdateBranchInput = {
  ref: string
  commitMessage: string
  token: string
}

export const updateBranch = async (input: UpdateBranchInput) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await exec.exec('git', ['log', '--graph', '--decorate', '--stat', '--pretty=fuller', '--max-count=10'])
  await execWithToken(input.token, ['push', 'origin', `HEAD:${input.ref}`])
}

type CreateBranchInput = {
  branch: string
  commitMessage: string
  token: string
}

export const createBranch = async (input: CreateBranchInput) => {
  await exec.exec('git', ['checkout', '-b', input.branch])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await exec.exec('git', ['log', '--graph', '--decorate', '--stat', '--pretty=fuller', '--max-count=10'])
  await execWithToken(input.token, ['push', 'origin', input.branch])
}

const execWithToken = async (token: string, args: readonly string[] = []) => {
  const credentials = Buffer.from(`x-access-token:${token}`).toString('base64')
  core.setSecret(credentials)
  return await exec.exec('git', [
    // reset extraheader set by actions/checkout
    // https://github.com/actions/checkout/issues/162#issuecomment-590821598
    '-c',
    `http.https://github.com/.extraheader=`,
    // replace the token
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${credentials}`,
    ...args,
  ])
}

export const status = async (): Promise<string> => {
  const o = await exec.getExecOutput('git', ['status', '--porcelain'])
  return o.stdout.trim()
}


