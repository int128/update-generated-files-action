import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const setConfigUser = async (name: string, email: string) => {
  await exec.exec('git', ['config', 'user.name', name])
  await exec.exec('git', ['config', 'user.email', email])
}

type UpdateBranchInput = {
  branch: string
  commitMessage: string
  token: string
}

export const updateBranch = async (input: UpdateBranchInput) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await push(input.token, ['origin', `HEAD:${input.branch}`])
}

type CreateBranchInput = {
  branch: string
  commitMessage: string
  token: string
}

export const createBranch = async (input: CreateBranchInput) => {
  await exec.exec('git', ['checkout', '-b', input.branch])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await push(input.token, ['origin', input.branch])
}

const push = async (token: string, args: readonly string[] = []) => {
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
    'push',
    ...args,
  ])
}

export const status = async (): Promise<string> => {
  const o = await exec.getExecOutput('git', ['status', '--porcelain'])
  return o.stdout.trim()
}
