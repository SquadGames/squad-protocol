/* global require module */

import { content, ContentInput, registerPurchasableContent } from '../src'
import { ethers } from 'ethers'
import { getConfig } from '@squad/lib'

const uniqueType = `testType-${ethers.Wallet.createRandom().address}`
const data = ` { "type": "${uniqueType}", "underlyingWorks": [] }`
const commonData = ' { "type": "common", "underlyingWorks": [] }'

async function wait(ms: number): Promise<void> {
  return new Promise((a, r) => {
    setTimeout(a, ms)
  })
}

describe('content', () => {
  let config: any

  beforeAll(async () => {
    config = await getConfig()

    const contents = [
      ['content1', 'metadata1', 10, 1, data, 'UTF8_STRING', 'UTF8_STRING'],
      ['content2', 'metadata1', 20, 2, data, 'UTF8_STRING', 'UTF8_STRING'],
      ['content3', 'metadata4', 30, 3, commonData, 'UTF8_STRING', 'UTF8_STRING']
    ]

    for (const i in contents) {
      const args = contents[i]
      if (args === undefined) {
        throw new Error('never')
      }
      const [
        content,
        metadata,
        sharePercentage,
        price,
        data,
        contentMedium,
        metadataMedium
      ] = args
      await registerPurchasableContent(
        content as string,
        metadata as string,
        sharePercentage as number,
        price as number,
        data as string,
        contentMedium as string,
        metadataMedium as string
      )
      await wait(200)
    }
  })

  test('returns content by type', async () => {
    const got = await content({ _type: uniqueType })
    const lines = got.split('\n')
    expect(lines.length).toBe(2)
    const line = lines[0]
    if (line === undefined) {
      throw new Error('never')
    }
    const [
      entityType,
      contentType,
      id,
      ...tags
    ] = line.split(' ')
    expect(entityType).toBe('Content')
    expect(contentType).toBe(uniqueType)
    if (id === undefined) {
      expect(id).toBeDefined()
      throw 'narrow type scope, id was undefined'
    }
    expect(
      id.split('-')[0] ?? ''
    ).toBe(
      config.contracts.ERC721Squad.address.toLowerCase()
    )
    expect(ethers.BigNumber.from(id.split('-')[1] ?? '').gte(0)).toBe(true)
  })

  test('returns content by nftAddress', async () => {
    const got = await content({
      nftAddress: config.contracts.ERC721Squad.address
    })
    const lines = got.split('\n')
    expect(lines.length).toBeGreaterThan(3)
    const line = lines[1]
    if (line === undefined) {
      throw new Error('never')
    }
    const [
      entityType,
      contentType,
      id,
      ...tags
    ] = line.split(' ')
    if (id === undefined) {
      expect(id).toBeDefined()
      throw new Error('unexpected undefined id')
    }
    expect(id.split('-')[0]).toBe(
      config.contracts.ERC721Squad.address.toLowerCase()
    )
  })

  test('returns content by id', async () => {
    const contentId = `${config.contracts.ERC721Squad.address.toLowerCase()}-0x1`
    const got = await content({ id: contentId })
    expect(got.trim().includes('\n')).toBe(false)
    expect(got.split(' ')[2]).toBe(contentId)
  })
})
