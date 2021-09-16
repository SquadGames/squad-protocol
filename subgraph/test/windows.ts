import { ethers } from 'ethers'
import {
  getAccounts,
  querySubgraph,
  queryContent,
  sendAliceNFT,
  mintAndRegisterPL,
  registerRSL,
  mintDaiAndPurchase,
  delay,
  DEF_PRICE,
  DEF_TYPE,
  getPercentScale
} from './utils'
import { toHexLeaf, toLeaf, Balance } from '../../hardhat/lib/merkleTools'
import { MerkleTree, makeMerkleTree, getHexRoot, getHexProof } from '../../lib'
import { abi } from '../../hardhat/artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json'
import { getConfig } from '@squad/lib'

const config = getConfig()
const provider = ethers.getDefaultProvider(config.networkNameOrUrl)

interface PurchaseEvent {
  id: string;
  license: any;
  pricePaid: string;
}

interface Share {
  contentId: string;
  nftAddress: string;
  nftId: string;
  percentage: ethers.BigNumber;
}

interface ContentRevShare {
  contentId: string;
  amount: ethers.BigNumber;
  shares: Share[];
}

interface UnderlyingWork {
  id: string;
  nftAddress: string;
  nftId: string;
  revShareLicenses: {
    minShareBasisPoints: number
  }[];
  underlyingWorks: UnderlyingWork[];
}

// Mint a bunch of NFTs that use each other as underlying works and give them different owners
async function populatePurchases() {
  const accounts = await getAccounts()
  const nft1 = await mintAndRegisterPL([])
  await registerRSL(nft1, 10, DEF_TYPE, [])
  await sendAliceNFT(nft1, accounts[1])
  await delay

  const content1 = await queryContent(nft1)
  await mintDaiAndPurchase(nft1, DEF_PRICE)
  const nft2 = await mintAndRegisterPL([content1.id])
  await registerRSL(nft2, 20, DEF_TYPE, [content1.id])
  await sendAliceNFT(nft2, accounts[2])
  await delay

  const content2 = await queryContent(nft2)
  await mintDaiAndPurchase(nft2, DEF_PRICE)
  const nft3 = await mintAndRegisterPL([content1.id, content2.id])
  await registerRSL(nft3, 30, DEF_TYPE, [content1.id, content2.id])
  await sendAliceNFT(nft3, accounts[3])
  await delay
  
  await mintDaiAndPurchase(nft3, DEF_PRICE)
  console.log('completed purchases')
}

// TODO: change the flattening algorithm so that it weights underlying works shares by their individual shareBasisPoints
// (i.e. work 1 sharing 50% with work 2 and work 3. Work 2 asks for 50%, work 3 asks for 20%. This should work out to:
// work 1: 50%, work 2: 5/7 * 50% ~ 36%, work 3: 2/7 * 50% ~ 14%)


function flattenShares(
  baseContentId: string,
  baseContentNftAddress: string,
  baseContentNftId: string,
  underlyingWorks: UnderlyingWork[],
  totalSharePercent: ethers.BigNumber, // the total percent the results of this function should add up to
  percentScale: ethers.BigNumber
): Share[] {
  let results: Share[] = []
  if (underlyingWorks.length > 0) {
    let sharePercentage = ethers.BigNumber.from("0")
    let shareSubTotal = ethers.BigNumber.from("0")
    // find the highest minShareBasisPoints among the underlying works 
    // (this will be the percent split between UWs)
    // also find the total of the minShareBasis points
    // (this will be used to calc how much each UW gets)
    underlyingWorks.forEach(uw => {
      // TODO in the future, if there is more than one kind of revShareLicense, we will need to figure out which 
      // to look at here. If not, we should switch to only allowing a single revShareLicense (no array)
      const rsl = uw.revShareLicenses[0]
      shareSubTotal = ethers.BigNumber.from(rsl.minShareBasisPoints).add(shareSubTotal)
      if (ethers.BigNumber.from(rsl.minShareBasisPoints).gt(sharePercentage)) {
        sharePercentage = ethers.BigNumber.from(rsl.minShareBasisPoints)
      }
    })
    // convert sharePercentage from basis points to percent * percentScale
    sharePercentage = sharePercentage.mul(percentScale).div(100)
    // add baseContent to results
    results.push({
      contentId: baseContentId,
      nftAddress: baseContentNftAddress,
      nftId: baseContentNftId,
      percentage: percentScale.mul(100).sub(sharePercentage)
    })
    // recursively flatten underlyingWorks shares
    underlyingWorks.forEach(uw => {
      const uwShare = ethers.BigNumber.from(uw.revShareLicenses[0].minShareBasisPoints)
      const percentForUw = sharePercentage.mul(uwShare).div(shareSubTotal)
      // if we need to go a layer deeper
      if(uw.underlyingWorks.length > 0) {
        results = results.concat(
          flattenShares(
            uw.id,
            uw.nftAddress,
            uw.nftId,
            uw.underlyingWorks,
            percentForUw,
            percentScale
          )
        )
      // if we don't
      } else {
        results.push({
          contentId: uw.id,
          nftAddress: uw.nftAddress,
          nftId: uw.nftId,
          percentage: percentForUw
        })
      }
    })
  } else {
    // add baseContent to results
    results.push({
      contentId: baseContentId,
      nftAddress: baseContentNftAddress,
      nftId: baseContentNftId,
      percentage: percentScale.mul(100)
    })
  }
  
  // multiply percentages so they sum to totalSharePercent instead of 100
  let sum = ethers.BigNumber.from("0")
  results = results.map(share => {
    const percentage = share.percentage
      .mul(totalSharePercent)
      .div(
        percentScale.mul(100)
      )
    sum = sum.add(percentage)
    return Object.assign(share, {
      percentage
    })
  })

  return results
}

async function calcWindow(): Promise<{ balances: Balance[], merkleTree: MerkleTree }> {
  // start where previous window ended
  const startBlockData = (await querySubgraph(`{
    windows(first: 1, orderBy: blockNumber, orderDirection: desc) {
      blockNumber
    }
  }`))

  let startBlock: number

  // handle the case where there are no previous windows
  if (startBlockData.data.windows.length > 0) {
    startBlock = startBlockData.data.windows[0].blockNumber
  } else {
    startBlock = 0
  }
  
  // get all revenue events between then and now
  // TODO: make this recursive
  const purchases = (await querySubgraph(`{
    purchaseEvents(where: {blockNumber_gte: ${startBlock} }) {
      pricePaid
      license {
        content {
          id
          nftAddress
          nftId
          underlyingWorks {
            id
            nftAddress
            nftId
            revShareLicenses {
              minShareBasisPoints
            }
            underlyingWorks {
              id
              nftAddress
              nftId
              revShareLicenses {
                minShareBasisPoints
              }
              underlyingWorks {
                id
                nftAddress
                nftId
                revShareLicenses {
                  minShareBasisPoints
                }
                underlyingWorks {
                  id
                  nftAddress
                  nftId
                  revShareLicenses {
                    minShareBasisPoints
                  }
                  underlyingWorks {
                    id
                    nftAddress
                    nftId
                    revShareLicenses {
                      minShareBasisPoints
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`)).data.purchaseEvents

  // add up pricePaid for all purchases to find total revenue for the period -- we need this to calc percentages
  const totalRevenue: ethers.BigNumber = purchases.reduce((total: ethers.BigNumber, purchase: PurchaseEvent) => {
    return total.add(ethers.BigNumber.from(purchase.pricePaid))
  }, ethers.BigNumber.from("0"))

  // get the scale our contracts use for percentages
  // we need this because the merkleTree must be constructed using scaled percentages, not raw
  const percentScale = await getPercentScale()

  const contentRevShares: { [contentId: string]: ContentRevShare} = {}

  // find the share percentages for each piece of content that made revenue
  purchases.forEach((purchase: PurchaseEvent) => {
    const contentId: string = purchase.license.content.id
    // if not already added, add to the contentRevShares and flatten shares
    if (!Object.keys(contentRevShares).includes(contentId)) {
      contentRevShares[contentId] = {
        contentId,
        amount: ethers.BigNumber.from(purchase.pricePaid),
        shares: flattenShares(
          purchase.license.content.id, 
          purchase.license.content.nftAddress,
          purchase.license.content.nftId,
          purchase.license.content.underlyingWorks,
          percentScale.mul(100),
          percentScale
        )
      }
    // if already added, just add the price paid
    } else {
      contentRevShares[contentId].amount = contentRevShares[contentId].amount
        .add(ethers.BigNumber.from(purchase.pricePaid))
    }
  })

  const balanceObj: { [contentId: string]: Balance } = {}

  // arrange data by content and its overall rev share percent
  for(let i = 0; i < Object.keys(contentRevShares).length; i++) {
    const contentId = Object.keys(contentRevShares)[i]

    for(let j = 0; j < contentRevShares[contentId].shares.length; j++) {
      const share = contentRevShares[contentId].shares[j]
      const nftContract = new ethers.Contract(share.nftAddress, abi, provider)
      const account = await nftContract.ownerOf(
        ethers.BigNumber.from(share.nftId)
      )
      if (!balanceObj[account]) {
        balanceObj[account] = {
          account,
          allocation: ethers.BigNumber.from("0")
        }
      }
      balanceObj[account].allocation = balanceObj[account].allocation
        .add(
          share.percentage
            .mul(contentRevShares[contentId].amount)
            .div(totalRevenue)
        )
    }
  }

  // TODO: check that the total allocation sums to 100%?
  let total = ethers.BigNumber.from("0")
  const balances: Balance[] = Object.values(balanceObj).map((pb) => {
    total = total.add(pb.allocation)
    return pb
  })

  console.log('expected total, got total:', Number(percentScale.mul(100)), Number(total))

  const merkleTree: MerkleTree = makeMerkleTree(balances.map(bal => toLeaf(bal)))

  return { balances, merkleTree }
}

populatePurchases()
  .then(() => {
    calcWindow()
      .then(console.log)
  })