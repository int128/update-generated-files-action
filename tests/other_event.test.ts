import * as git from '../src/git.js'
import { handleOtherEvent } from '../src/other_event.js'

const octokitMock = {
  rest: {
    pulls: {
      create: jest.fn(),
      requestReviewers: jest.fn(),
    },
    issues: {
      addAssignees: jest.fn(),
      addLabels: jest.fn(),
    },
  },
}

jest.mock('@actions/core')
jest.mock('@actions/github', () => ({ getOctokit: () => octokitMock }))
jest.mock('../src/git')

test('follow up by fast-forward', async () => {
  jest.mocked(git.getAuthorNameOfCommits).mockResolvedValueOnce(['octocat'])
  jest.mocked(git.push).mockResolvedValueOnce(0)

  const outputs = await handleOtherEvent(
    {
      commitMessage: 'Generated by GitHub Actions (workflow / job)',
      commitMessageFooter: 'https://github.com/int128/update-generated-files-action/actions/runs/4309709120',
      title: 'Follow up the generated files',
      body: 'This pull request will fix the generated files.',
      draft: false,
      reviewers: ['myname', 'awesome/myteam'],
      labels: [],
      token: 'GITHUB_TOKEN',
    },
    {
      ref: 'refs/heads/main',
      runNumber: 321,
      actor: 'octocat',
      eventName: 'dummy',
      sha: '0123456789abcdef',
      repo: {
        owner: 'int128',
        repo: 'update-generated-files-action',
      },
    },
  )

  expect(outputs).toStrictEqual({})
  expect(git.commit).toHaveBeenCalledTimes(1)
  expect(git.commit).toHaveBeenCalledWith(
    `Generated by GitHub Actions (workflow / job)

https://github.com/int128/update-generated-files-action/actions/runs/4309709120`,
  )
  expect(git.push).toHaveBeenCalledTimes(1)
  expect(git.push).toHaveBeenCalledWith({
    ref: 'refs/heads/main',
    token: 'GITHUB_TOKEN',
    ignoreReturnCode: true,
  })
})

test('fallback to pull-request', async () => {
  jest.mocked(git.getAuthorNameOfCommits).mockResolvedValueOnce(['octocat'])
  jest.mocked(git.push).mockResolvedValueOnce(1)
  jest.mocked(git.push).mockResolvedValueOnce(0)

  octokitMock.rest.pulls.create.mockResolvedValueOnce({
    data: {
      number: 987,
      html_url: 'https://github.com/int128/update-generated-files-action/pulls/987',
      base: {
        repo: {
          full_name: 'int128/update-generated-files-action',
        },
      },
    },
  })

  const outputs = await handleOtherEvent(
    {
      commitMessage: 'Generated by GitHub Actions (workflow / job)',
      commitMessageFooter: 'https://github.com/int128/update-generated-files-action/actions/runs/4309709120',
      title: 'Follow up the generated files',
      body: 'This pull request will fix the generated files.',
      draft: false,
      reviewers: ['myname', 'awesome/myteam'],
      labels: ['mylabel'],
      token: 'GITHUB_TOKEN',
    },
    {
      ref: 'refs/heads/main',
      runNumber: 321,
      actor: 'octocat',
      eventName: 'dummy',
      sha: '0123456789abcdef',
      repo: {
        owner: 'int128',
        repo: 'update-generated-files-action',
      },
    },
  )

  expect(outputs).toStrictEqual({
    error: undefined,
    pullRequestUrl: 'https://github.com/int128/update-generated-files-action/pulls/987',
    pullRequestNumber: 987,
  })
  expect(git.commit).toHaveBeenCalledTimes(1)
  expect(git.commit).toHaveBeenCalledWith(
    `Generated by GitHub Actions (workflow / job)

https://github.com/int128/update-generated-files-action/actions/runs/4309709120`,
  )
  expect(git.push).toHaveBeenCalledTimes(2)
  expect(git.push).toHaveBeenCalledWith({
    ref: 'refs/heads/main',
    token: 'GITHUB_TOKEN',
    ignoreReturnCode: true,
  })
  expect(git.push).toHaveBeenCalledWith({
    ref: 'refs/heads/update-generated-files-0123456789abcdef-321',
    token: 'GITHUB_TOKEN',
  })

  expect(octokitMock.rest.pulls.create).toHaveBeenCalledWith({
    owner: 'int128',
    repo: 'update-generated-files-action',
    base: 'main',
    head: 'update-generated-files-0123456789abcdef-321',
    draft: false,
    title: 'Follow up the generated files',
    body: `This pull request will fix the generated files.

----

Generated by GitHub Actions (workflow / job)
https://github.com/int128/update-generated-files-action/actions/runs/4309709120`,
  })
  expect(octokitMock.rest.pulls.requestReviewers).toHaveBeenCalledWith({
    owner: 'int128',
    pull_number: 987,
    repo: 'update-generated-files-action',
    reviewers: ['myname'],
    team_reviewers: ['myteam'],
  })
  expect(octokitMock.rest.issues.addLabels).toHaveBeenCalledWith({
    labels: ['mylabel'],
    issue_number: 987,
    owner: 'int128',
    repo: 'update-generated-files-action',
  })
})
