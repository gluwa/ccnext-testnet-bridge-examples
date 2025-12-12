// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {EvmV1Decoder} from "./EvmV1Decoder.sol";

interface INativeQueryVerifier {
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    struct ContinuityBlock {
        bytes32 merkleRoot;
        bytes32 digest;
    }

    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        ContinuityBlock[] blocks;
    }

    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);
}

library NativeQueryVerifierLib {
    address constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000FD2;

    function getVerifier() internal pure returns (INativeQueryVerifier) {
        return INativeQueryVerifier(PRECOMPILE_ADDRESS);
    }
}

contract SimpleMinterUSC is ERC20 {
    /// @notice The Native Query Verifier precompile instance
    /// @dev Address: 0x0000000000000000000000000000000000000FD2 (4050 decimal)
    INativeQueryVerifier public immutable VERIFIER;

    uint256 constant MINT_AMOUNT = 1_000;

    event TokensMinted(address indexed token, address indexed recipient, uint256 amount, bytes32 indexed queryId);

    mapping(bytes32 => bool) public processedQueries;

    constructor() ERC20("Mintable (TEST)", "TEST") {
        // Get the precompile instance using the helper library
        VERIFIER = NativeQueryVerifierLib.getVerifier();
    }

    /**
     * @notice Calculates the transaction index from the merkle proof path
     */
    function _calculateTransactionIndex(INativeQueryVerifier.MerkleProofEntry[] memory proof)
        internal
        pure
        returns (uint256 index)
    {
        index = 0;
        for (uint256 i = 0; i < proof.length; i++) {
            index = index * 2 + (proof[i].isLeft ? 1 : 0);
        }
        return index;
    }

    function mintFromQuery(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        INativeQueryVerifier.ContinuityBlock[] calldata continuityBlocks
    ) external returns (bool success) {
        // Calculate transaction index from merkle proof path
        uint256 transactionIndex = _calculateTransactionIndex(siblings);

        // Check if the query has already been processed
        bytes32 txKey;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, chainKey)
            mstore(add(ptr, 32), shl(192, blockHeight))
            mstore(add(ptr, 40), transactionIndex)
            txKey := keccak256(ptr, 72)
        }
        require(!processedQueries[txKey], "Query already processed");

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});

        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: lowerEndpointDigest, blocks: continuityBlocks});

        // Verify inclusion proof
        bool verified = VERIFIER.verify(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof);

        require(verified, "Verification failed");

        processedQueries[txKey] = true;

        // Validate transaction type
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        require(EvmV1Decoder.isValidTransactionType(txType), "Unsupported transaction type");

        // Decode and validate receipt status
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        require(receipt.receiptStatus == 1, "Transaction did not succeed");

        EvmV1Decoder.CommonTxFields memory txFields = EvmV1Decoder.decodeCommonTxFields(encodedTransaction);
        require(txFields.to == address(0), "Transaction not sent to zero address");

        // TODO: Add more validation here

        // If the transaction validation passes, mint tokens to the sender
        _mint(msg.sender, MINT_AMOUNT);

        emit TokensMinted(address(this), msg.sender, MINT_AMOUNT, txKey);

        return true;
    }
}
