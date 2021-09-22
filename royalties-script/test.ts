import { ethers } from 'ethers'
import {
  queryContent,
  sendAliceNFT,
  mintAndRegisterPL,
  registerRSL,
  mintDaiAndPurchase,
  delay,
  DEF_PRICE,
  DEF_TYPE
} from '@squad/subgraph/test/utils'
import { calcWindow } from './index'

// Mint a bunch of NFTs that use each other as underlying works and give them different owners
async function populatePurchases() {
  const wallet1 = ethers.Wallet.createRandom()
  const nft1 = await mintAndRegisterPL([])
  await registerRSL(nft1, 10, DEF_TYPE, [])
  await sendAliceNFT(nft1, wallet1.address)
  await delay

  const wallet2 = ethers.Wallet.createRandom()
  const content1 = await queryContent(nft1)
  await mintDaiAndPurchase(nft1, DEF_PRICE)
  const nft2 = await mintAndRegisterPL([content1.id])
  await registerRSL(nft2, 20, DEF_TYPE, [content1.id])
  await sendAliceNFT(nft2, wallet2.address)
  await delay

  const wallet3 = ethers.Wallet.createRandom()
  const content2 = await queryContent(nft2)
  await mintDaiAndPurchase(nft2, DEF_PRICE)
  const nft3 = await mintAndRegisterPL([content1.id, content2.id])
  await registerRSL(nft3, 30, DEF_TYPE, [content1.id, content2.id])
  await sendAliceNFT(nft3, wallet3.address)
  await delay
  
  await mintDaiAndPurchase(nft3, DEF_PRICE)
  console.log('completed purchases')
}

populatePurchases()
  .then(() => {
    calcWindow()
      .then(console.log)
  })