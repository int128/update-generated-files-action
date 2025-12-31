import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const AUTHOR_NAME = 'update-generated-files-action'
export const AUTHOR_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com'

const authorFlags: readonly string[] = ['-c', `user.name=${AUTHOR_NAME}`, '-c', `user.email=${AUTHOR_EMAIL}`]

export const status = async (): Promise<string> => {
  const { stdout } = await exec.getExecOutput('git', ['status', '--porcelain'])
  return stdout.trim()
}

export const getAuthorNameOfCommits = async (ref: string, depth: number): Promise<string[]> => {
  const { stdout } = await exec.getExecOutput('git', ['log', '--format=%an', `--max-count=${depth}`, ref])
  return stdout.trim().split('\n')
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
  await exec.exec('git', [...authorFlags, 'merge', '--no-ff', '-m', message, sha])

export const canMerge = async (base: string, head: string): Promise<boolean> =>
  (await exec.exec('git', ['merge-base', base, head], { ignoreReturnCode: true })) === 0

export const cherryPick = async (sha: string) => await exec.exec('git', [...authorFlags, 'cherry-pick', sha])

export const tryCherryPick = async (sha: string): Promise<boolean> => {
  const code = await exec.exec('git', [...authorFlags, 'cherry-pick', sha], { ignoreReturnCode: true })
  if (code === 0) {
    return true
  }
  await exec.exec('git', ['cherry-pick', '--abort'])
  return false
}

export const commit = async (message: string, additionalMessages: string[]) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec('git', [
    ...authorFlags,
    'commit',
    '--quiet',
    '-m',
    message,
    ...additionalMessages.flatMap((message) => ['-m', message]),
  ])
}

type FetchInput = {
  refs: string[]
  depth: number
}

export const fetch = async (input: FetchInput) =>
  await execWithToken(['fetch', 'origin', `--depth=${input.depth}`, ...input.refs])

export const push = async (ref: string, options?: exec.ExecOptions) =>
  await execWithToken(['push', 'origin', `HEAD:${ref}`], options)

const execWithToken = async (args: readonly string[], options?: exec.ExecOptions) => {
  const credentials = Buffer.from(`x-access-token:${core.getInput('token')}`).toString('base64')
  core.setSecret(credentials)
  return await exec.exec(
    'git',
    [
      // reset extraheader set by actions/checkout
      // https://github.com/actions/checkout/issues/162#issuecomment-590821598
      '-c',
      `http.https://github.com/.extraheader=`,
      // replace the token
      '-c',
      `http.https://github.com/.extraheader=AUTHORIZATION: basic ${credentials}`,
      ...args,
    ],
    options,
  )
}
