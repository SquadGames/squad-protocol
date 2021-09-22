/* global require module */

import { version } from '../src'

describe('version', () => {
  test('returns the current version', async () => {
    expect(await version()).toBe('0.0.1-dev')
  })
})
