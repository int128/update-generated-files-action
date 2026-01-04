import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import { Octokit } from '@octokit/action'
import { retry } from '@octokit/plugin-retry'
import type { PullRequestEvent, WebhookEvent } from '@octokit/webhooks-types'

export const getOctokit = () => new (Octokit.plugin(retry))()

export type Context<E = WebhookEvent> = {
  repo: {
    owner: string
    repo: string
  }
  actor: string
  eventName: string
  ref: string
  sha: string
  runId: number
  serverUrl: string
  payload: E
}

export const getContext = async (): Promise<Context> => {
  // https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  return {
    repo: getRepo(),
    actor: getEnv('GITHUB_ACTOR'),
    eventName: getEnv('GITHUB_EVENT_NAME'),
    ref: getEnv('GITHUB_REF'),
    sha: getEnv('GITHUB_SHA'),
    runId: Number.parseInt(getEnv('GITHUB_RUN_ID'), 10),
    serverUrl: getEnv('GITHUB_SERVER_URL'),
    payload: JSON.parse(await fs.readFile(getEnv('GITHUB_EVENT_PATH'), 'utf-8')) as WebhookEvent,
  }
}

const getRepo = () => {
  const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/')
  return { owner, repo }
}

const getEnv = (name: string): string => {
  assert(process.env[name], `${name} is required`)
  return process.env[name]
}

export const contextIsPullRequestEvent = (context: Context<WebhookEvent>): context is Context<PullRequestEvent> =>
  toPullRequestEvent(context.payload) !== undefined

const toPullRequestEvent = (payload: WebhookEvent): PullRequestEvent | undefined => {
  if ('pull_request' in payload && 'number' in payload) {
    return payload
  }
}
