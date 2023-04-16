import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const setConfigUser = async (name: string, email: string) => {
  await exec.exec('git', ['config', 'user.name', name])
  await exec.exec('git', ['config', 'user.email', email])
}

export const getCurrentSHA = async (): Promise<string> => {
  const { stdout } = await exec.getExecOutput('git', ['rev-parse', 'HEAD'])
  return stdout.trim()
}

export const getParentSHAs = async (sha: string): Promise<string[]> => {
  const { stdout } = await exec.getExecOutput('git', ['cat-file', 'commit', sha])
  return parseParentsOfGitCatFile(stdout)
}

export const parseParentsOfGitCatFile = (stdout: string): string[] => {
  const parents = []
  for (const m of stdout.matchAll(/^parent ([0-9a-f]+)/gm)) {
    parents.push(m[1])
  }
  return parents
}

export const showGraph = async () =>
  await exec.exec('git', ['log', '--max-count=10', '--graph', '--decorate', '--pretty=oneline', '--color=always'])

export const checkout = async (sha: string) => await exec.exec('git', ['checkout', sha])

export const merge = async (sha: string, message: string) =>
  await exec.exec('git', ['merge', '--no-ff', '-m', message, sha])

export const canMerge = async (base: string, head: string): Promise<boolean> =>
  (await exec.exec('git', ['merge-base', base, head], { ignoreReturnCode: true })) === 0

export const stash = async () => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['stash'])
}

export const stashPop = async () => await exec.exec('git', ['stash', 'pop'])

export const commit = async (message: string) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', message])
}

type FetchInput = {
  refs: string[]
  depth: number
  token: string
}

export const fetch = async (input: FetchInput) =>
  await execWithToken(input.token, ['fetch', 'origin', `--depth=${input.depth}`, ...input.refs])

type PushInput = {
  ref: string
  token: string
}

export const push = async (input: PushInput) =>
  await execWithToken(input.token, ['push', 'origin', `HEAD:${input.ref}`])

type CreateBranchInput = {
  branch: string
  commitMessage: string
  token: string
}

export const createBranch = async (input: CreateBranchInput) => {
  await exec.exec('git', ['checkout', '-b', input.branch])
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', ['commit', '-m', input.commitMessage])
  await exec.exec('git', ['log', '--max-count=10', '--graph', '--decorate', '--pretty=fuller', '--color=always'])
  await execWithToken(input.token, ['push', 'origin', input.branch])
}

const execWithToken = async (token: string, args: readonly string[]) => {
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
