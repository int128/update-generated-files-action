import * as core from '@actions/core'
import type { PullRequestEvent, WebhookEvent } from '@octokit/webhooks-types'
import { describe, expect, test, vi } from 'vitest'
import * as git from '../src/git.js'
import type { Context } from '../src/github.js'
import { handlePullRequestEvent, type Inputs } from '../src/pull_request_event.js'

vi.mock('@actions/core')
vi.mocked(core.info).mockImplementation(() => {})
vi.mock('../src/git')

describe('pull request event', () => {
  const inputs: Inputs = {
    commitMessage: 'Autofix (workflow / job)',
    commitMessageFooter: '',
    dryRun: false,
  }
  const context: Context<PullRequestEvent> = {
    ref: 'refs/pull/1/merge',
    actor: 'octocat',
    eventName: 'pull_request',
    sha: '0123456789abcdef-merge',
    repo: {
      owner: 'int128',
      repo: 'update-generated-files-action',
    },
    runId: 1234567890,
    serverUrl: 'https://github.com',
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
    } as WebhookEvent as PullRequestEvent,
  }

  test('checkout with merge commit', async () => {
    vi.mocked(git.getCommitMessages).mockResolvedValue(['Commit message'])
    vi.mocked(git.getCurrentSHA).mockResolvedValue('0123456789abcdef-merge')
    vi.mocked(git.canMerge).mockResolvedValueOnce(false)
    vi.mocked(git.canMerge).mockResolvedValueOnce(true)
    vi.mocked(git.getParentSHAs).mockResolvedValueOnce(['0123456789abcdef-latest-base', '0123456789abcdef-head'])

    await handlePullRequestEvent(inputs, context)

    expect(git.checkout).toHaveBeenCalledWith('0123456789abcdef-head')
    expect(git.merge).toHaveBeenCalledWith('0123456789abcdef-latest-base', [
      `Merge branch 'main' into topic`,
      `Auto-generated-by: update-generated-files-action; https://github.com/int128/update-generated-files-action/actions/runs/1234567890`,
    ])
    expect(git.commit).toHaveBeenCalledWith([
      `Autofix (workflow / job)`,
      ``,
      `Auto-generated-by: update-generated-files-action; https://github.com/int128/update-generated-files-action/actions/runs/1234567890`,
    ])
    expect(git.push).toHaveBeenCalledTimes(1)
    expect(git.push).toHaveBeenCalledWith({ localRef: `HEAD`, remoteRef: `refs/heads/topic`, dryRun: false })
  })

  test('checkout with head commit', async () => {
    vi.mocked(git.getCommitMessages).mockResolvedValue(['Commit message'])
    vi.mocked(git.getCurrentSHA).mockResolvedValue('0123456789abcdef-head')
    await handlePullRequestEvent(inputs, context as Context<PullRequestEvent>)

    expect(git.checkout).not.toHaveBeenCalled()
    expect(git.merge).not.toHaveBeenCalled()
    expect(git.commit).toHaveBeenCalledWith([
      `Autofix (workflow / job)`,
      ``,
      `Auto-generated-by: update-generated-files-action; https://github.com/int128/update-generated-files-action/actions/runs/1234567890`,
    ])
    expect(git.push).toHaveBeenCalledTimes(1)
    expect(git.push).toHaveBeenCalledWith({ localRef: `HEAD`, remoteRef: `refs/heads/topic`, dryRun: false })
  })
})
