import * as exec from '@actions/exec'

export const setConfigUser = async (name: string, email: string) => {
  await exec.exec('git', ['config', 'user.name', name])
  await exec.exec('git', ['config', 'user.email', email])
}

export const updateCurrentBranch = async (commitMessage: string) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', commitMessage])
  await exec.exec('git', ['push'])
}

export const createBranch = async (branch: string, commitMessage: string) => {
  await exec.exec('git', ['checkout', '-b', branch])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['status'])
  await exec.exec('git', ['commit', '-m', commitMessage])
  await exec.exec('git', ['push', 'origin', branch])
}

export const status = async (): Promise<string> => {
  const o = await exec.getExecOutput('git', ['status', '--porcelain'])
  return o.stdout.trim()
}

export const getLastAuthorFromLog = async () => {
  const o = await exec.getExecOutput('git', ['log', '-n1', '--format=%an'])
  return o.stdout.trim()
}
