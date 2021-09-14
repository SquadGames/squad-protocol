/**
- QUERY timestamp of previous window
- find all revenue events between then and now
    - QUERY all purchase events between then and now (only current revenue event)
        - include:
            - purchased content
            - purchasableLicense for each content
            - underlying works of each content + their rev share licenses
            - underlying works of the underlying works + their rev share licenses * 10 (for now, just check 10 layers deep. Figure out a better way later if needed)
- add up all revenue event amounts to find totalRevenue
- get PERCENTAGE SCALE from Royalties contract
- construct full list of splits
    - for each purchase event:

        *purchase event: { content.id, content.purchasableLicense.sharePercentage, content.underlyingWorks: { id, underlyingWorks: {...} }[], amount }*

        - flatten shares
            - if we didn't already flatten this content Id
                - flatten it
                - register the flattened shares in a new object
        - add amount to current total for the contentId

            *sharePercents: { contentId: { revShare: {contentId, percentage}, ...}, contentAmount }, ...}*

    - for each contentId in *sharePercents*
        - totalPercent = contentId.contentAmount / totalRevenue
        - for each revShare:
            - percentagePortion = revShare.percentage * totalPercent
            - res[revShare.contentId].allocation += percentagePortion
            - look up current NFT owner for the address

        *balancesObject: { contentId: percentage, ... }*

    - convert balances object into array
        - multipl7 by scalePercentage
        - check that unscaled percents add to 100
        - grab nftOwner addresses that correspond to contentIds

        *balances = [{nftOwner, scaledPercentage}]*

- create merkle tree / root from balances array
- return merkle root and balances array
 */

import { ethers } from 'ethers'
import {
  getProofInfo,
  signer,
  querySubgraph,
  queryContent,
  mintAndRegisterPL,
  registerRSL,
  mintDaiAndPurchase,
  delay,
  DEF_PRICE,
  DEF_TYPE,
  queryWindow,
  queryTransfer,
  mintAndIncrement,
  claim,
  getPercentScale,
  getBalanceForWindow,
  getTotalClaimableBalance,
  getCurrentWindow
} from './utils'
import { toHexLeaf, toLeaf, Balance } from '../../hardhat/lib/merkleTools'
import { MerkleTree, makeMerkleTree, getHexRoot, getHexProof } from '../../lib'
import { abi } from '../../hardhat/artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json'
import { getConfig } from '@squad/lib'

const config = getConfig()
const provider = ethers.getDefaultProvider(config.networkNameOrUrl)

// we need these NFTs to have a bunch of different owners, so that more than one person gets an allocation
// we also need some of these to register rev share licenses!
  // the reaon is: purchaseable licenses only specify a share percent for revenue from purchases
  // not revenue to be shared from other sources! so without a rev share license, we don't know how much to share
  // from a piece of content that receives non-purchase revenue to its underlying works
async function populatePurchases() {
  const nft1 = await mintAndRegisterPL([])
  await registerRSL(nft1, 10, DEF_TYPE, [])
  await delay
  const content1 = await queryContent(nft1)
  await mintDaiAndPurchase(nft1, DEF_PRICE)
  const nft2 = await mintAndRegisterPL([content1.id])
  await registerRSL(nft2, 20, DEF_TYPE, [content1.id])
  await delay
  const content2 = await queryContent(nft2)
  await mintDaiAndPurchase(nft2, DEF_PRICE)
  const nft3 = await mintAndRegisterPL([content1.id, content2.id])
  await registerRSL(nft3, 30, DEF_TYPE, [content1.id, content2.id])
  await delay
  const content3 = await queryContent(nft3)
  await mintDaiAndPurchase(nft3, DEF_PRICE)
  console.log('completed purchases')
}

async function calcWindow() {
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
  const purchases = (await querySubgraph(`{
    purchaseEvents(where: {blockNumber_gte: ${startBlock} }) {
      pricePaid
      license {
        sharePercentage
        content {
          id
          nftAddress
          nftId
          underlyingWorks {
            id
            nftAddress
            nftId
            revShareLicenses {
              minSharePercentage
            }
            underlyingWorks {
              id
              nftAddress
              nftId
              revShareLicenses {
                minSharePercentage
              }
              underlyingWorks {
                id
                nftAddress
                nftId
                revShareLicenses {
                  minSharePercentage
                }
                underlyingWorks {
                  id
                  nftAddress
                  nftId
                  revShareLicenses {
                    minSharePercentage
                  }
                  underlyingWorks {
                    id
                    nftAddress
                    nftId
                    revShareLicenses {
                      minSharePercentage
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

  interface PurchaseEvent {
    id: string;
    license: any;
    pricePaid: string;
  }

  console.log('purchases', purchases)

  const totalRevenue: number = purchases.reduce((total: number, purchase: PurchaseEvent) => {
    return total + Number(purchase.pricePaid)
  }, 0)

  console.log("total revenue", totalRevenue)

  const percentScale = Number(await getPercentScale())

  console.log("percentage scale", percentScale)

  interface Share {
    contentId: string;
    nftAddress: string;
    nftId: string;
    percentage: number;
  }

  interface ContentRevShare {
    contentId: string;
    amount: ethers.BigNumber;
    sharesFlattened: boolean;
    shares: Share[];
  }

  interface UnderlyingWork {
    id: string;
    nftAddress: string;
    nftId: string;
    revShareLicenses: {
      minSharePercentage: number
    }[];
    underlyingWorks: UnderlyingWork[];
  }

  function flattenShares(
    baseContentId: string,
    baseContentNftAddress: string,
    baseContentNftId: string,
    underlyingWorks: UnderlyingWork[],
    totalSharePercent: number, // the total percent the results of this function should add up to
    baseContentSharePercent?: number, // the percent the baseContent's licenses dictate it shares with UWs
  ): Share[] {
    let results: Share[] = []
    if (underlyingWorks.length > 0) {
      const warnings: UnderlyingWork[] = []
      let sharePercentage: number = 0
      // find the highest minSharePercentage among the underlying works 
      // (this will be the percent split between UWs if no basePercent is given)
      underlyingWorks.forEach(uw => {
        uw.revShareLicenses.forEach(rsl => {
          // issue a warning if a minSharePercentage is higher than the basePercent
          if (baseContentSharePercent) {
            if (rsl.minSharePercentage > baseContentSharePercent) {
              warnings.push(uw)
            }
          } else {
            if (rsl.minSharePercentage > sharePercentage) {
              sharePercentage = rsl.minSharePercentage
            }
          }
        })
      })
      if (baseContentSharePercent) { 
        if (warnings.length > 0) {
          console.log("WARNING: The following content requires a higher rev share than the basePercent.", warnings)
        }
        sharePercentage = baseContentSharePercent 
      }
      // add baseContent to results
      results.push({
        contentId: baseContentId,
        nftAddress: baseContentNftAddress,
        nftId: baseContentNftId,
        percentage: 100 - sharePercentage
      })
      // recusively flatten underlyingWorks shares
      underlyingWorks.forEach(uw => {
        const percentPerUw = sharePercentage / underlyingWorks.length
        // if we need to go a layer deeper
        if(uw.underlyingWorks.length > 0) {
          results = results.concat(
            flattenShares(
              uw.id,
              uw.nftAddress,
              uw.nftId,
              uw.underlyingWorks,
              percentPerUw
            )
          )
        // if we don't
        } else {
          results.push({
            contentId: uw.id,
            nftAddress: uw.nftAddress,
            nftId: uw.nftId,
            percentage: percentPerUw
          })
        }
      })
    } else {
      // add baseContent to results
      results.push({
        contentId: baseContentId,
        nftAddress: baseContentNftAddress,
        nftId: baseContentNftId,
        percentage: 100
      })
    }
    
    // multiply percentages so they sum to totalSharePercent instead of 100
    let sum = 0
    results = results.map(share => {
      sum += share.percentage * totalSharePercent / 100
      return Object.assign(share, {
        percentage: share.percentage * totalSharePercent / 100
      })
    })
    // console.log("check sum", sum, totalSharePercent)
    /*
    console.log("inputs",
      baseContentId,
      underlyingWorks,
      totalSharePercent,
      baseContentSharePercent
    )
    */

    return results
  }

  // find the share percentages for each piece of content
  const contentRevShares: { [contentId: string]: ContentRevShare} = {}

  purchases.forEach((purchase: PurchaseEvent) => {
    const contentId: string = purchase.license.content.id
    // add to the object
    if (!Object.keys(contentRevShares).includes(contentId)) {
      contentRevShares[contentId] = {
        contentId,
        amount: ethers.BigNumber.from(purchase.pricePaid),
        sharesFlattened: false,
        shares: []
      }
    // or add the price paid
    } else {
      contentRevShares[contentId].amount = contentRevShares[contentId].amount
        .add(ethers.BigNumber.from(purchase.pricePaid))
    }
    // flatten shares
    if (contentRevShares[contentId].sharesFlattened === false) {
      // the rest of the content's shares
      contentRevShares[contentId].shares = flattenShares(
        purchase.license.content.id, 
        purchase.license.content.nftAddress,
        purchase.license.content.nftId,
        purchase.license.content.underlyingWorks,
        100,
        purchase.license.sharePercentage
      )
      contentRevShares[contentId].sharesFlattened = true
    }
  })
  console.log('example shares', contentRevShares[
    Object.keys(contentRevShares)[0]
  ].shares)
  /*
  - for each contentId in *sharePercents*
        - totalPercent = contentId.contentAmount / totalRevenue
        - for each revShare:
            - percentagePortion = revShare.percentage * totalPercent
            - res[revShare.contentId].allocation += percentagePortion
            - look up current NFT owner for the address

        *balancesObject: { contentId: percentage, ... }*
  */
  interface PercentBalance {
    account: string,
    allocationPercent: number
  }

  const balanceObj: { [contentId: string]: PercentBalance } = {}

  for(let i = 0; i < Object.keys(contentRevShares).length; i++) {
    const contentId = Object.keys(contentRevShares)[i]
    /*
    console.log('calculating localPortion', 
      Number(contentRevShares[contentId].amount), 
      Number(totalRevenue),
      Number(contentRevShares[contentId].amount) / Number(totalRevenue)
    )
    */
    const localPortion = Number(contentRevShares[contentId].amount) / totalRevenue

    for(let j = 0; j < contentRevShares[contentId].shares.length; j++) {
      const share = contentRevShares[contentId].shares[j]
      const nftContract = new ethers.Contract(share.nftAddress, abi, provider)
      const account = await nftContract.ownerOf(
        ethers.BigNumber.from(share.nftId)
      )
      if (!balanceObj[account]) {
        balanceObj[account] = {
          account,
          allocationPercent: 0
        }
      }
      balanceObj[account].allocationPercent += share.percentage * localPortion
    }
  }
  // note that the allocations don't sum to exactly 100 because precision is too low -- is there a solution?
  console.log('balanceObj', balanceObj)

  // (node:32261) UnhandledPromiseRejectionWarning: Error: underflow (fault="underflow", operation="BigNumber.from", value=99999999.99999991, code=NUMERIC_FAULT, version=bignumber/5.4.1)
  const balances: Balance[] = Object.values(balanceObj).map(pb => {
    return {
      account: pb.account,
      allocation: ethers.BigNumber.from(pb.allocationPercent * percentScale)
    }
  })

  console.log('balances', balances)
}

populatePurchases()
  .then(() => {
    calcWindow()
  })