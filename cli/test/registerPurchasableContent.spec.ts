/* global require module __dirname */

import { registerPurchasableContent } from '../src'
import path from 'path'
import { ethers } from 'ethers'

const content = path.join(__dirname, 'test-content/content-a.json')
const price = 10
const sharePercentage = 20
const data = ' { "test-key": "test-value", "type": "registerTest", "underlyingWorks": [] }'

function isAddress (addr: string, log = false): boolean {
  try {
    ethers.utils.getAddress(addr)
    return true
  } catch (e) {
    if (log) console.error(e)
    return false
  }
}

describe('registerPurchasableContent', () => {
  test('registers content', async () => {
    const got = await registerPurchasableContent(
      content,
      ' { "meta": true, "test": true }',
      sharePercentage,
      price,
      data,
      'auto',
      'UTF8_STRING'
    )

    const [
      nftAddress,
      nftId,
      registrant,
      outPrice,
      outSharePercentage,
      licesnseTokenAddress,
      ...outData
    ] = got.trim().split(' ')

    if (nftAddress === undefined) {
      expect(nftAddress).toBeDefined()
      throw new Error('unexpected undefined nftAddress')
    }
    expect(isAddress(nftAddress)).toBe(true)
    const parsedNftId = parseInt(nftId ?? '')
    expect(parsedNftId).toBeGreaterThan(-1)
    expect(parsedNftId).toBeLessThan(1000)
    if (registrant === undefined) {
      expect(registrant).toBeDefined()
      throw new Error('unexpected undefined registrant')
    }
    expect(isAddress(registrant)).toBe(true)
    expect(outPrice).toBe(price.toString())
    expect(outSharePercentage).toBe(sharePercentage.toString())
    expect(outData.join(' ')).toBe(data)
  })
})
