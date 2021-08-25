import { TokenMinted } from '../../generated/ERC721Squad/ERC721Squad'
import { SquadNFT } from '../../generated/schema'

export function handleTokenMinted(event: TokenMinted): void {
  let nft = new SquadNFT(event.params.tokenId.toString())
  nft.creator = event.params.creator
  nft.contentURI = event.params.contentURI
  nft.metadataURI = event.params.metadataURI
  nft.contentHash = event.params.contentHash
  nft.metadataHash = event.params.metadataHash
  nft.blockCreated = event.block.number
  nft.save()
}