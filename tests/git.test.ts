import type { WebhookEvent } from '@octokit/webhooks-types'
import { describe, expect, it, test } from 'vitest'
import { gitTokenConfigFlags, parseParentsOfGitCatFile } from '../src/git.js'

describe('parseParentsOfGitCatFile', () => {
  test('merge commit', () => {
    const parents = parseParentsOfGitCatFile(
      `tree a40f48872c3a8c3550e1d8a2a905ed2ab5b1c486
parent c3a9301749696252fc2c2e5658d1e2e9170ca447
parent b8499467560ea7c46fe4ed6837c264f4ad15fd8a
author Example <example@example.com> 1680955205 +0000
committer GitHub <noreply@github.com> 1680955205 +0000
gpgsig -----BEGIN PGP SIGNATURE-----

  wsBcBAABCAAQBQJkMVdFCRBK7hj4Ov3rIwAAQZ0IAEzsDkEi1NVzPelh7pZh9rt/
  B8E24sGyeE+g0pDRzLzjRQfDHKPPeCAIDomK9pPgK01/gbgy1F2kGCiD0dy7thT2
  Vu0OT0A5WSKLOadi8LlV/HW+8ynr12EyEH5K9hesapjQ1L8t3h89Qb++OF4FjeNB
  ZfrCSmzy1XBiFLjQMUv3I3AO6K651QOaXEbJGF/qWc7G0x4bI6R1ERY0pGXiHFPz
  MHYl6qiUyTHgc+5omyBwZD3BAQ4KiGHJvF/caiqC7opMToXXgGsVa4eRm/r4NQ5C
  yvksikDFrbOAPLEt05UwbCQ9WT8dTcT1ZNDM3bGWU8wAW0fEHx37eULg79fUk2U=
  =6BsJ
  -----END PGP SIGNATURE-----


Merge b8499467560ea7c46fe4ed6837c264f4ad15fd8a into c3a9301749696252fc2c2e5658d1e2e9170ca447`,
    )
    expect(parents).toStrictEqual([
      'c3a9301749696252fc2c2e5658d1e2e9170ca447',
      'b8499467560ea7c46fe4ed6837c264f4ad15fd8a',
    ])
  })

  test('trivial commit', () => {
    const parents = parseParentsOfGitCatFile(
      `tree 73825940c39e16906260090afe501bb82866d9ac
parent 4d763299eef55d4b4285f5259876ff462b55017c
author Example <example@example.com> 1681562385 +0900
committer Example <example@example.com> 1681562385 +0900

Dummy`,
    )
    expect(parents).toStrictEqual(['4d763299eef55d4b4285f5259876ff462b55017c'])
  })
})

describe('gitTokenConfigFlags', () => {
  it('returns the flags for GitHub', () => {
    const githubContext = {
      ref: 'refs/heads/main',
      actor: 'octocat',
      eventName: 'dummy',
      sha: '0123456789abcdef',
      repo: {
        owner: 'int128',
        repo: 'update-generated-files-action',
      },
      runId: 1234567890,
      serverUrl: 'https://github.com',
      payload: {} as WebhookEvent,
    }
    expect(gitTokenConfigFlags(githubContext)).toEqual([
      '-c',
      'http.https://github.com/.extraheader=',
      '--config-env=http.https://github.com/.extraheader=CONFIG_VALUE_AUTHORIZATION_HEADER',
    ])
  })
})
