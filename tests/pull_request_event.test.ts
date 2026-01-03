import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import type { PullRequestEvent } from '@octokit/webhooks-types'
import { describe, expect, test, vi } from 'vitest'
import * as git from '../src/git.js'
import type { Context } from '../src/github.js'
import { handlePullRequestEvent, type Inputs } from '../src/pull_request_event.js'

const octokitMock = {
  rest: {
    git: {
      getCommit: vi.fn().mockResolvedValue({
        data: {
          sha: 'dummy-commit-sha',
          message: 'Dummy commit message',
          tree: {
            sha: 'dummy-tree-sha',
          },
          parents: [],
        },
      }),
      createCommit: vi.fn().mockResolvedValue({
        data: {
          sha: 'dummy-commit-sha',
        },
      }),
      updateRef: vi.fn(),
    },
  },
}

vi.mock('@actions/core')
vi.mocked(core.info).mockImplementation(() => {})
vi.mock('../src/git')

describe('pull request event', () => {
  const inputs: Inputs = {
    commitMessage: 'Autofix (workflow / job)',
    commitMessageFooter: 'https://github.com/int128/update-generated-files-action/actions/runs/4309709120',
    dryRun: false,
  }
  const context = {
    sha: '0123456789abcdef-merge',
    repo: {
      owner: 'int128',
      repo: 'update-generated-files-action',
    },
    payload: {
      action: 'dummy',
      pull_request: {
        base: {
          ref: 'main',
        },
        head: {
          ref: 'topic',
          sha: '0123456789abcdef-head',
        },
      },
    },
  }

  test('checkout with merge commit', async () => {
    vi.mocked(git.getAuthorNameOfCommits).mockResolvedValue(['renovate[bot]'])
    vi.mocked(git.getCurrentSHA).mockResolvedValue('0123456789abcdef-merge')
    vi.mocked(git.canMerge).mockResolvedValueOnce(false)
    vi.mocked(git.canMerge).mockResolvedValueOnce(true)
    vi.mocked(git.getParentSHAs).mockResolvedValueOnce(['0123456789abcdef-latest-base', '0123456789abcdef-head'])

    await handlePullRequestEvent(inputs, context as Context<PullRequestEvent>, octokitMock as unknown as Octokit)

    expect(git.checkout).toHaveBeenCalledWith('0123456789abcdef-head')
    expect(git.merge).toHaveBeenCalledWith('0123456789abcdef-latest-base', `Merge branch 'main' into topic`)
    expect(git.commit).toHaveBeenCalledWith(`Autofix (workflow / job)`, [
      `https://github.com/int128/update-generated-files-action/actions/runs/4309709120`,
    ])
    expect(git.push).toHaveBeenCalledTimes(3)
    expect(git.push).toHaveBeenCalledWith({ localRef: `HEAD`, remoteRef: `refs/heads/topic`, dryRun: false })
  })

  test('checkout with head commit', async () => {
    vi.mocked(git.getAuthorNameOfCommits).mockResolvedValue(['renovate[bot]'])
    vi.mocked(git.getCurrentSHA).mockResolvedValue('0123456789abcdef-head')
    await handlePullRequestEvent(inputs, context as Context<PullRequestEvent>, octokitMock as unknown as Octokit)

    expect(git.checkout).not.toHaveBeenCalled()
    expect(git.merge).not.toHaveBeenCalled()
    expect(git.commit).toHaveBeenCalledWith(`Autofix (workflow / job)`, [
      `https://github.com/int128/update-generated-files-action/actions/runs/4309709120`,
    ])
    expect(git.push).toHaveBeenCalledTimes(1)
    expect(git.push).toHaveBeenCalledWith({ localRef: `HEAD`, remoteRef: `refs/heads/topic`, dryRun: false })
  })

  test('last authors are this action', async () => {
    vi.mocked(git.getAuthorNameOfCommits).mockResolvedValue([
      git.AUTHOR_NAME,
      git.AUTHOR_NAME,
      git.AUTHOR_NAME,
      git.AUTHOR_NAME,
      git.AUTHOR_NAME,
    ])
    await expect(
      handlePullRequestEvent(inputs, context as Context<PullRequestEvent>, octokitMock as unknown as Octokit),
    ).rejects.toThrow(/infinite loop/)
  })
})
