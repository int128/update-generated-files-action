import * as core from '@actions/core'
import * as exec from '@actions/exec'

export const AUTHOR_NAME = 'update-generated-files-action'
export const AUTHOR_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com'

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
  core.startGroup(`Getting the parent commits of ${sha}`)
  const { stdout } = await exec.getExecOutput('git', ['cat-file', 'commit', sha])
  core.endGroup()
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

export const checkout = async (sha: string) => await exec.exec('git', ['checkout', '--quiet', sha])

export const merge = async (sha: string, message: string) =>
  await exec.exec('git', ['merge', '--quiet', '--no-ff', '-m', message, sha], {
    env: {
      ...process.env,
      GIT_COMMITTER_NAME: AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
      GIT_AUTHOR_NAME: AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    },
  })

export const canMerge = async (base: string, head: string): Promise<boolean> =>
  (await exec.exec('git', ['merge-base', base, head], { ignoreReturnCode: true })) === 0

export const cherryPick = async (sha: string) =>
  await exec.exec('git', ['cherry-pick', sha], {
    env: {
      ...process.env,
      GIT_COMMITTER_NAME: AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
      GIT_AUTHOR_NAME: AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    },
  })

export const tryCherryPick = async (sha: string): Promise<boolean> => {
  const code = await exec.exec('git', ['cherry-pick', sha], {
    ignoreReturnCode: true,
    env: {
      ...process.env,
      GIT_COMMITTER_NAME: AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
      GIT_AUTHOR_NAME: AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    },
  })
  if (code === 0) {
    return true
  }
  await exec.exec('git', ['cherry-pick', '--abort'])
  return false
}

export const commit = async (message: string, additionalMessages: string[]) => {
  await exec.exec('git', ['add', '.'])
  await exec.exec(
    'git',
    ['commit', '--quiet', '-m', message, ...additionalMessages.flatMap((message) => ['-m', message])],
    {
      env: {
        ...process.env,
        GIT_COMMITTER_NAME: AUTHOR_NAME,
        GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
        GIT_AUTHOR_NAME: AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
      },
    },
  )
}

type FetchInput = {
  refs: string[]
  depth: number
}

export const fetch = async (input: FetchInput) =>
  await exec.exec(
    'git',
    [
      '--config-env=http.extraheader=CONFIG_GIT_HTTP_EXTRAHEADER',
      '-c',
      'gc.auto=0',
      'fetch',
      'origin',
      // '--quiet',
      `--depth=${input.depth}`,
      ...input.refs,
    ],
    {
      env: {
        ...process.env,
        CONFIG_GIT_HTTP_EXTRAHEADER: authorizationHeader(),
      },
    },
  )

type PushInput = {
  localRef: string
  remoteRef: string
  dryRun: boolean
}

export const push = async (input: PushInput, options?: exec.ExecOptions) =>
  await exec.exec(
    'git',
    [
      '--config-env=http.extraheader=CONFIG_GIT_HTTP_EXTRAHEADER',
      '-c',
      'gc.auto=0',
      'push',
      'origin',
      '--quiet',
      ...(input.dryRun ? ['--dry-run'] : []),
      `${input.localRef}:${input.remoteRef}`,
    ],
    {
      ...options,
      env: {
        ...process.env,
        ...options?.env,
        CONFIG_GIT_HTTP_EXTRAHEADER: authorizationHeader(),
      },
    },
  )

export const deleteRef = async (ref: string) =>
  await exec.exec(
    'git',
    ['--config-env=http.extraheader=CONFIG_GIT_HTTP_EXTRAHEADER', 'push', 'origin', '--quiet', '--delete', ref],
    {
      env: {
        ...process.env,
        CONFIG_GIT_HTTP_EXTRAHEADER: authorizationHeader(),
      },
    },
  )

const authorizationHeader = () => {
  const credentials = Buffer.from(`x-access-token:${core.getInput('token')}`).toString('base64')
  core.setSecret(credentials)
  return `AUTHORIZATION: basic ${credentials}`
}
