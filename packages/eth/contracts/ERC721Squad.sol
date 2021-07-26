// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721Squad is ERC721 {
    using Counters for Counters.Counter;

    struct TokenData {
        // A valid URI of the content represented by this token
        string contentURI;
        // A valid URI of the metadata associated with this token
        string metadataURI;
    }

    Counters.Counter public tokenIdTracker;
    mapping(uint256 => string) public contentURIs;
    mapping(uint256 => string) public metadataURIs;

    event TokenMinted(
      uint256 tokenId,
      address creator,
      string contentURI,
      string metadataURI
    );

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    // public functions ---------------

    function mint(address creator, TokenData memory data) 
        external 
        validTokenData(data)
        returns(uint256) 
    {
        require(creator != address(0), "mint: creator is 0 address.");

        uint256 tokenId = tokenIdTracker.current();
        _safeMint(creator, tokenId);
        tokenIdTracker.increment();
        _setTokenData(tokenId, data);

        emit TokenMinted(
            tokenId,
            creator,
            data.contentURI,
            data.metadataURI
        );

        return tokenId;
    }

    function nextTokenId() external view returns(uint256) {
      return tokenIdTracker.current();
    }

    // internal functions -------------

    function _setTokenData(uint256 tokenId, TokenData memory data) internal {
        contentURIs[tokenId] = data.contentURI;
        metadataURIs[tokenId] = data.metadataURI;
    }

    // modifiers ----------------------

    modifier validTokenData(TokenData memory data) {
        require(bytes(data.contentURI).length != 0, "validTokenData: contentURI is missing.");
        require(bytes(data.metadataURI).length != 0, "validTokenData: metadataURI is missing.");
        _;
    }
}