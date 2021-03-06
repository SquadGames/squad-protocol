// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IERC721Squad {
    function mint(
      address creator,
      string calldata contentURI, 
      string calldata metadataURI,
      bytes32 contentHash,
      bytes32 metadataHash
    ) external returns(uint256);
}

contract LicenseManager {
    // TODO? string public fullTextURI;
    // TODO? string public fullTextHash;
    string public description;
    IERC721Squad public squadNft;

    constructor(string memory description_, address squadNftAddress) {
        description = description_;
        squadNft = IERC721Squad(squadNftAddress);
    }

    modifier onlyNFTOwner(address nftAddress, uint256 nftId) {
      require(ERC721(nftAddress).ownerOf(nftId) == msg.sender, "Message sender does not own NFT.");
      _;
    }
}