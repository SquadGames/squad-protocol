// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.5;

import "./LicenseManager.sol";
import "./ERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PurchasableLicenseManager is LicenseManager {
    //======== Structs ========

    struct LicenseParams {
        uint256 price;
        uint8 sharePercentage;
        ERC20Mintable licenseToken;
    }


    //======== State ========

    mapping(address => mapping(uint256 => LicenseParams)) public registeredNFTs;
    ERC20 public purchaseToken;
    address public royaltiesAddress;
    string public constant NAME = "PurchasableLicenseManager";


    //======== Events ========

    event NFTRegistered(
        address nftAddress, 
        uint256 nftId, 
        address registrant,
        uint256 price, 
        uint8 sharePercentage,
        address licenseTokenAddress,
        string data
    );

    event NFTUnregistered(
        address nftAddress,
        uint256 nftId
    );

    event Purchase(
        address nftAddress, 
        uint256 nftId, 
        address purchaser, 
        uint256 licensesBought,
        uint256 price,
        address licenseTokenAddress
    );


    //======== Constructor ========

    constructor(
        string memory description_,
        address squadNftAddress,
        address purchaseTokenAddress,
        address royaltiesAddress_
    ) LicenseManager(description_, squadNftAddress) {
        purchaseToken = ERC20(purchaseTokenAddress);
        royaltiesAddress = royaltiesAddress_;
    }


    //======== Public Functions ========

    function registerNFT(
        address nftAddress, 
        uint256 nftId, 
        address registrant,
        uint256 price, 
        uint8 sharePercentage,
        string calldata data
    ) 
        public
    {
        require(ERC721(nftAddress).ownerOf(nftId) == registrant, "Registrant does not own NFT.");
        require(sharePercentage <= 100, "sharePercentage greater than 100.");

        ERC721 nft = ERC721(nftAddress);
        string memory name = string(abi.encodePacked(NAME, nft.name(), nftId));
        string memory symbol = string(abi.encodePacked("l", nft.symbol(), nftId));
        ERC20Mintable licenseToken = new ERC20Mintable(name, symbol);
        
        registeredNFTs[nftAddress][nftId] = LicenseParams(
            price,
            sharePercentage,
            licenseToken
        );
        
        emit NFTRegistered(
            nftAddress,
            nftId,
            registrant,
            price,
            sharePercentage,
            address(licenseToken),
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
        uint256 price, 
        uint8 sharePercentage,
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
            nftId, 
            creator, 
            price, 
            sharePercentage, 
            data
        );
    }

    function unregisterNFT(address nftAddress, uint256 nftId) 
        external
        nftRegistered(nftAddress, nftId)
        onlyNFTOwner(nftAddress, nftId) 
    {
        delete registeredNFTs[nftAddress][nftId];

        emit NFTUnregistered(
            nftAddress,
            nftId
        );
    }

    function purchase(
        address nftAddress, 
        uint256 nftId, 
        address purchaser, 
        uint256 numberToBuy
    ) 
        external
        nftRegistered(nftAddress, nftId)
    {
        LicenseParams memory licenseParams = registeredNFTs[nftAddress][nftId];
        uint256 purchasePrice = licenseParams.price * numberToBuy;

        require(purchaseToken.transferFrom(purchaser, royaltiesAddress, purchasePrice), "Transfer failed.");
        licenseParams.licenseToken.mint(purchaser, numberToBuy * 1 ether);

        emit Purchase(
            nftAddress,
            nftId,
            purchaser,
            numberToBuy,
            purchasePrice,
            address(licenseParams.licenseToken)
        );
    }

    function holdsLicense(
        address nftAddress, 
        uint256 nftId, 
        address holder
    ) 
        external 
        view
        nftRegistered(nftAddress, nftId)
        returns(bool) 
    {
        LicenseParams memory licenseParams = registeredNFTs[nftAddress][nftId];
        return (licenseParams.licenseToken.balanceOf(holder) >= 1 ether);
    }


    //======== Modifiers ========

    modifier nftRegistered(address nftAddress, uint256 nftId) {
        LicenseParams memory licenseParams = registeredNFTs[nftAddress][nftId];
        require(address(licenseParams.licenseToken) != address(0), "NFT not registered.");
        _;
    }
}
