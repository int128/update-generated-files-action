import { describe, expect, it } from 'vitest'
import { parseAutoMerge } from '../src/auto_merge.js'

describe('parseAutoMerge', () => {
  it('returns undefined if disabled', () => {
    expect(parseAutoMerge(false, 'squash')).toBeUndefined()
  })
  it('returns the merge method in upper case', () => {
    expect(parseAutoMerge(true, 'squash')).toStrictEqual({ mergeMethod: 'SQUASH' })
    expect(parseAutoMerge(true, 'Merge')).toStrictEqual({ mergeMethod: 'MERGE' })
    expect(parseAutoMerge(true, 'REBASE')).toStrictEqual({ mergeMethod: 'REBASE' })
  })
  it('throws an error if the merge method is invalid', () => {
    expect(() => parseAutoMerge(true, 'fast-forward')).toThrow(
      'auto-merge-method must be one of merge, squash or rebase',
    )
  })
})
