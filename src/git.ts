import * as exec from '@actions/exec'

export const setConfigUser = async (name: string, email: string) => {
  await exec.exec('git', ['config', 'user.name', name])
  await exec.exec('git', ['config', 'user.email', email])
}

type UpdateCurrentBranchInput = {
  commitMessage: string
  token: string
}

export const updateCurrentBranch = async (input: UpdateCurrentBranchInput) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await exec.exec('git', [
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${input.token}`,
    'push',
    'origin',
  ])
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
  await exec.exec('git', [
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${input.token}`,
    'push',
    'origin',
    input.branch,
  ])
}

export const status = async (): Promise<string> => {
  const o = await exec.getExecOutput('git', ['status', '--porcelain'])
  return o.stdout.trim()
}

export const getLastAuthorFromLog = async () => {
  const o = await exec.getExecOutput('git', ['log', '-n1', '--format=%an'])
  return o.stdout.trim()
}
