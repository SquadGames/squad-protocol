// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.5;

import "./LicenseManager.sol";

contract RevShareLicenseManager is LicenseManager {
    //======== State ========

    mapping(address => mapping(uint256 => uint8)) public minSharePercentages;
    mapping(address => mapping(uint256 => bool)) public registeredNFTs;
    string public constant NAME = "RevShareLicenseManager";


    //======== Events ========

    event NFTRegistered(
        address nftAddress, 
        uint256 nftId, 
        address registrant,
        uint8 minSharePercentage,
        string data
    );

    event NFTUnregistered(
        address nftAddress, 
        uint256 nftId
    );


    //======== Constructor ========

    constructor(string memory description_, address squadNftAddress) 
        LicenseManager(description_, squadNftAddress) {}


    //======== Public Functions ========

    function registerNFT(
        address nftAddress, 
        uint256 nftId, 
        address registrant,
        uint8 minSharePercentage,
        string calldata data
    ) 
        public
    {
        require(ERC721(nftAddress).ownerOf(nftId) == registrant, "Registrant does not own NFT.");
        require(minSharePercentage <= 100, "minSharePercentage greater than 100.");

        minSharePercentages[nftAddress][nftId] = minSharePercentage;
        registeredNFTs[nftAddress][nftId] = true;

        emit NFTRegistered(
            nftAddress, 
            nftId, 
            registrant,
            minSharePercentage,
            data
        );
    }


    //======== External Functions ========

    function createAndRegisterNFT(
        address creator,
        string calldata contentURI, 
        string calldata metadataURI,
        bytes32 contentHash,
        bytes32 metadataHash,
        uint8 minSharePercentage,
        string calldata data
    ) external {
        uint256 nftId = squadNft.mint(
            creator, 
            contentURI, 
            metadataURI,
            contentHash,
            metadataHash
        );
        registerNFT(
            address(squadNft), 
            nftId, creator, 
            minSharePercentage, 
            data
        );
    }

    function unregisterNFT(address nftAddress, uint256 nftId) 
        external
        nftRegistered(nftAddress, nftId)
        onlyNFTOwner(nftAddress, nftId) 
    {
        require(registeredNFTs[nftAddress][nftId] == true, "NFT not registered.");

        delete minSharePercentages[nftAddress][nftId];
        registeredNFTs[nftAddress][nftId] = false;

        emit NFTUnregistered(
            nftAddress,
            nftId
        );
    }


    //======== Modifiers ========

    modifier nftRegistered(address nftAddress, uint256 nftId) {
      require(registeredNFTs[nftAddress][nftId] == true, "NFT not registered.");
      _;
    }
}