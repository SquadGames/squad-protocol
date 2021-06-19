// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.5;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);
}

/**
 * @title Royalties
 * @author SquadGames
 *
 * Extends work by the Mirror and Uniswap teams:
 * https://github.com/mirror-xyz/splits
 * https://github.com/Uniswap/merkle-distributor
 *
 */

contract Royalties is Ownable {
    // Storage
    bytes32[] public merkleRoots;
    uint256 public currentWindow;
    address public tokenAddress;
    uint256[] public balanceForWindow;
    uint256 internal totalClaimableBalance;
    mapping(bytes32 => bool) internal claimed;

    uint256 public constant PERCENTAGE_SCALE = 10e5;

    // The TransferToken event is emitted after each transfer.
    event TransferToken(
        address account,
        uint256 amount,
        address token
    );

    // Emits when a window is incremented.
    event WindowIncremented(uint256 currentWindow, uint256 fundsAvailable);

    constructor(address tokenAddress_) {
        tokenAddress = tokenAddress_;
    }

    function getNode(address account, uint256 percentageAllocation)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(account, percentageAllocation));
    }

    function scaleAmountByPercentage(uint256 amount, uint256 scaledPercent)
        public
        pure
        returns (uint256 scaledAmount)
    {
        /*
            Example:
                If there is 100 ETH in the account, and someone has 
                an allocation of 2%, we call this with 100 as the amount, and 200
                as the scaled percent.
                To find out the amount we use, for example: (100 * 200) / (100 * 100)
                which returns 2 -- i.e. 2% of the 100 ETH balance.
         */
        scaledAmount = (amount * scaledPercent) / (100 * PERCENTAGE_SCALE);
    }

    function claim(
        uint256 window,
        address account,
        uint256 scaledPercentageAllocation,
        bytes32[] calldata merkleProof
    ) external {
        require(currentWindow > window, "cannot claim for a future window");
        require(
            !isClaimed(window, account),
            "Account already claimed the given window"
        );

        setClaimed(window, account);

        require(
            verifyProof(
                merkleProof,
                merkleRoots[window],
                getNode(account, scaledPercentageAllocation)
            ),
            "Invalid proof"
        );

        uint256 claimedAmount = scaleAmountByPercentage(
            balanceForWindow[window],
            scaledPercentageAllocation
        );
        transferToken(
            account,
            // The absolute amount that's claimable.
            claimedAmount
        );

        totalClaimableBalance -= claimedAmount;
    }

    function incrementWindow(bytes32 merkleRoot) public onlyOwner {
        uint256 fundsAvailable;
        fundsAvailable = IERC20(tokenAddress).balanceOf(address(this)) - totalClaimableBalance;
        require(fundsAvailable > 0, "No additional funds for window");

        totalClaimableBalance += fundsAvailable;

        balanceForWindow.push(fundsAvailable);
        merkleRoots[currentWindow] = merkleRoot;
        currentWindow += 1;

        emit WindowIncremented(currentWindow, fundsAvailable);
    }

    function isClaimed(uint256 window, address account)
        public
        view
        returns (bool)
    {
        return claimed[getClaimHash(window, account)];
    }

    //======== Private Functions ========

    function setClaimed(uint256 window, address account) private {
        claimed[getClaimHash(window, account)] = true;
    }

    function getClaimHash(uint256 window, address account)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(window, account));
    }

    // Transfer the reserve token
    function transferToken(address to, uint256 value) private {
        IERC20(tokenAddress).transfer(to, value);
        emit TransferToken(to, value, tokenAddress);
    }

    // From https://github.com/protofire/zeppelin-solidity/blob/master/contracts/MerkleProof.sol
    function verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) private pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
        }

        // Check if the computed hash (root) is equal to the provided root
        return computedHash == root;
    }
}