// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./block_prover.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SimpleMinterUSC is ERC20 {
    /// @notice The Native Query Verifier precompile instance
    /// @dev Address: 0x0000000000000000000000000000000000000FD2 (4050 decimal)
    INativeQueryVerifier public immutable verifier;

    event TokensMinted(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed queryId
    );

    mapping(bytes32 => bool) public processedQueries;

    constructor() ERC20("Mintable (TEST)", "TEST") {
        // Get the precompile instance using the helper library
        verifier = NativeQueryVerifierLib.getVerifier();
    }

    function mintFromQuery(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        INativeQueryVerifier.ContinuityBlock[] calldata continuityBlocks
    ) external returns (bool success) {
        bytes32 queryId = keccak256(abi.encodePacked(chainKey, height, encodedTransaction));
        require(!processedQueries[queryId], "Query already processed");

        INativeQueryVerifier.MerkleProof memory merkleProof = INativeQueryVerifier.MerkleProof({
            root: merkleRoot, 
            siblings: siblings
        });

        INativeQueryVerifier.ContinuityProof memory continuityProof = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: lowerEndpointDigest, 
            blocks: continuityBlocks  
        });

        bool verified = verifier.verify(
            chainKey,
            height,
            encodedTransaction,
            merkleProof,
            continuityProof
        );

        require(verified, "Verification failed");

        _mint(msg.sender, 1_000);
        processedQueries[queryId] = true;
        emit TokensMinted(address(this), msg.sender, 1_000, queryId);
        return true;
    }
}
