import { ethers } from 'ethers'
import {
  querySubgraph,
  getPercentScale
} from '@squad/subgraph/test/utils'
import { toLeaf, Balance } from '../hardhat/lib/merkleTools'
import { MerkleTree, makeMerkleTree } from '@squad/lib'
import { abi } from '../hardhat/artifacts/@openzeppelin/contracts/token/ERC721/ERC721.sol/ERC721.json'
import { getConfig } from '@squad/lib'

const config = getConfig()
const provider = ethers.getDefaultProvider(config.networkNameOrUrl)

/**
 * Units (all using ethers.BigNumber type):
 * _wei = currency unit
 * _basisPoints = percentage multiplied by 100 (1 BP = .01 %)
 * _shares = rights to revenue in a window
 */

interface PurchaseEvent {
  id: string;
  license: any;
  pricePaid: string;
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

interface RevShare {
  contentId: string;
  nftAddress: string;
  nftId: string;
  shares: ethers.BigNumber;
}

function bnMax(numbers: ethers.BigNumber[]): ethers.BigNumber {
  let result = ethers.BigNumber.from("0")
  numbers.forEach(n => {
    if (n.gt(result)) { result = n }
  })
  return result
}

function bnSum(numbers: ethers.BigNumber[]): ethers.BigNumber {
  return numbers.reduce((total, n) => total.add(n), ethers.BigNumber.from("0"))
}

function flattenShares(
  baseContentId: string,
  baseContentNftAddress: string,
  baseContentNftId: string,
  underlyingWorks: UnderlyingWork[],
  localTotal_shares: ethers.BigNumber // the total shares to be split
): RevShare[] {
  let results: RevShare[] = []

  if (underlyingWorks.length > 0) {
    // get max and total basisPoints from underlying works
    const basisPoints: ethers.BigNumber[] = underlyingWorks.map(uw => {
      return ethers.BigNumber.from(uw.revShareLicenses[0].minShareBasisPoints)
    })
    const uwMax_basisPoints = bnMax(basisPoints)
    const uwTotal_basisPoints = bnSum(basisPoints)
    const uwMax_shares = uwMax_basisPoints.mul(localTotal_shares).div(100)

    // add base content to results
    results.push({
      contentId: baseContentId,
      nftAddress: baseContentNftAddress,
      nftId: baseContentNftId,
      shares: localTotal_shares.sub(uwMax_shares)
    })

    // recursively flatten underlying works shares
    underlyingWorks.forEach(uw => {
      // rev share this work asks for
      const uw_basisPoints = ethers.BigNumber.from(uw.revShareLicenses[0].minShareBasisPoints)

      // this work's portion of shares based on its ask compared to its sibling underlying works' asks
      const uw_shares = uwMax_shares.mul(uw_basisPoints).div(uwTotal_basisPoints)
      
      results = results.concat(
        flattenShares(
          uw.id,
          uw.nftAddress,
          uw.nftId,
          uw.underlyingWorks,
          uw_shares
        )
      )
    })
  } else {
    // add base content to results
    results.push({
      contentId: baseContentId,
      nftAddress: baseContentNftAddress,
      nftId: baseContentNftId,
      shares: localTotal_shares
    })
  }

  return results
}

function purchasesQuery(startBlock: number): string {
  return `{
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
  }`
}

interface PurchasedContent {
  contentId: string;
  nftAddress: string;
  nftId: string;
  amount_wei: ethers.BigNumber;
  underlyingWorks: UnderlyingWork[];
  revShares: RevShare[];
}

export async function calcWindow(): Promise<{ balances: Balance[], merkleTree: MerkleTree }> {
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
  const purchases = (await querySubgraph(
    purchasesQuery(startBlock)
  )).data.purchaseEvents

  // find total revenue
  const totalRevenue_wei = purchases.reduce((total: ethers.BigNumber, purchase: PurchaseEvent) => {
    return total.add(ethers.BigNumber.from(purchase.pricePaid))
  }, ethers.BigNumber.from("0"))

  // find total shares (100% * the royalties contract's percent scale)
  const total_shares = (await getPercentScale()).mul(100)

  // group data by unique piece of content that generated revenue
  const contentRevenue: { [contentId: string]: PurchasedContent} = {}

  purchases.forEach((purchase: PurchaseEvent) => {
    const contentId: string = purchase.license.content.id
    // if not already added, add to contentRevenue
    if (!Object.keys(contentRevenue).includes(contentId)) {
      contentRevenue[contentId] = {
        contentId,
        nftAddress: purchase.license.content.nftAddress,
        nftId: purchase.license.content.nftId,
        amount_wei: ethers.BigNumber.from(purchase.pricePaid),
        underlyingWorks: purchase.license.content.underlyingWorks,
        revShares: []
      }
    // if already added, just add the price paid
    } else {
      contentRevenue[contentId].amount_wei = contentRevenue[contentId].amount_wei
        .add(ethers.BigNumber.from(purchase.pricePaid))
    }
  })

  // find shares for each revenue-generating piece of content and their underlying works
  Object.keys(contentRevenue).forEach(contentId => {
    contentRevenue[contentId].revShares = flattenShares(
      contentId,
      contentRevenue[contentId].nftAddress,
      contentRevenue[contentId].nftId,
      contentRevenue[contentId].underlyingWorks,
      total_shares.mul(contentRevenue[contentId].amount_wei).div(totalRevenue_wei)
    )
  })

  // organize data by any content that will be shared revenue in the window
  const balanceObj: { [contentId: string]: Balance } = {}

  for(let i = 0; i < Object.keys(contentRevenue).length; i++) {
    const contentId = Object.keys(contentRevenue)[i]

    for(let j = 0; j < contentRevenue[contentId].revShares.length; j++) {
      const revShare = contentRevenue[contentId].revShares[j]
      const nftContract = new ethers.Contract(revShare.nftAddress, abi, provider)
      const account = await nftContract.ownerOf(
        ethers.BigNumber.from(revShare.nftId)
      )
      if (!balanceObj[account]) {
        balanceObj[account] = {
          account,
          allocation: ethers.BigNumber.from("0")
        }
      }
      balanceObj[account].allocation = balanceObj[account].allocation
        .add(revShare.shares)
    }
  }

  // create merkle tree
  let total = ethers.BigNumber.from("0")
  const balances: Balance[] = Object.values(balanceObj).map((pb) => {
    total = total.add(pb.allocation)
    return pb
  })

  console.log('expected total, got total:', Number(total_shares), Number(total))

  const merkleTree: MerkleTree = makeMerkleTree(balances.map(bal => toLeaf(bal)))

  return { balances, merkleTree }
}