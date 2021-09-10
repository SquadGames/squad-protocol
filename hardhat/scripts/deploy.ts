import fs from 'fs'
import path from 'path'

import { ethers } from 'ethers'
import { ERC20Mintable__factory } from '../typechain/factories/ERC20Mintable__factory'
import { Royalties__factory } from '../typechain/factories/Royalties__factory'
import { ERC721Squad__factory } from '../typechain/factories/ERC721Squad__factory'
import { RevShareLicenseManager__factory } from '../typechain/factories/RevShareLicenseManager__factory'
import { PurchasableLicenseManager__factory } from '../typechain/factories/PurchasableLicenseManager__factory'
import { getConfig, writeConfig, getSecrets } from '@squad/lib'

function getAbiPath (contractName: string): string {
  const filePath = path.resolve(
    `./artifacts/contracts/${contractName}.sol/${contractName}.json`
  )
  if (!fs.existsSync(filePath)) {
    throw new Error(`could not find ${contractName} ABI at ${filePath}`)
  }
  return filePath
}

async function main (): Promise<void> {
  const config = getConfig()
  const secrets = getSecrets()
  const network: string = config.networkNameOrUrl
  const provider = ethers.getDefaultProvider(network)
  const signer = new ethers.Wallet(secrets.deployPrivateKey, provider)

  const ERC20MintableFactory = new ERC20Mintable__factory(signer)
  const RoyaltiesFactory = new Royalties__factory(signer)
  const SquadNftFactory = new ERC721Squad__factory(signer)
  const RevSharelicenseManagerFactory = new RevShareLicenseManager__factory(signer)
  const PurchasableLicenseManagerFactory = new PurchasableLicenseManager__factory(signer)

  // only when deploying to local network or test networks
  // TODO what do we do for the ERC20 address when not using fake DAI?
  const erc20 = await ERC20MintableFactory.deploy('Fake DAI', 'fDAI')
  console.log(`fDai deployed to ${erc20.address}`)
  config.contracts.ERC20Mintable = {
    address: erc20.address,
    abiPath: getAbiPath('ERC20Mintable')
  }

  // mint some erc20 for the test accounts
  const rpcProvider = new ethers.providers.JsonRpcProvider(network)
  const testAccounts = await rpcProvider.listAccounts()
  if (testAccounts.length === 10 && testAccounts[0] === '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1') {
    for(const i in testAccounts) {
      const testAccount = testAccounts[i]
      await erc20.mint(testAccount, ethers.utils.parseEther('500'))
      console.log(`minted 500 fDai for ${testAccount}`)
    }
  }

  const royalties = await RoyaltiesFactory.deploy(erc20.address)
  console.log(`Royalties deployed to ${royalties.address}`)
  config.contracts.Royalties = {
    address: royalties.address,
    abiPath: getAbiPath('Royalties')
  }

  const squadNft = await SquadNftFactory.deploy('Squad', 'sNFT')
  console.log(`ERC721Squad deployed to ${squadNft.address}`)
  config.contracts.ERC721Squad = {
    address: squadNft.address,
    abiPath: getAbiPath('ERC721Squad')
  }

  const revShareLicenseManager = await RevSharelicenseManagerFactory.deploy(
    'Revenue share license',
    squadNft.address
  )
  console.log(`RevShareLicenseManager deployed to ${revShareLicenseManager.address}`)
  config.contracts.RevShareLicenseManager = {
    address: revShareLicenseManager.address,
    abiPath: getAbiPath('RevShareLicenseManager')
  }

  const purchasableLicenseManager = await PurchasableLicenseManagerFactory.deploy(
    'Purchasable license',
    squadNft.address,
    erc20.address,
    royalties.address
  )
  console.log(`PurchasableLicenseManager deployed to ${purchasableLicenseManager.address}`)
  config.contracts.PurchasableLicenseManager = {
    address: purchasableLicenseManager.address,
    abiPath: getAbiPath('PurchasableLicenseManager')
  }
  writeConfig(config)
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error)
    process.exit(1)
  })
