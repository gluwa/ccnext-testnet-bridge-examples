import dotenv from 'dotenv';
import { Contract, ContractEventPayload, ethers, InterfaceAbi } from 'ethers';

import { EncodingVersion, raw } from '@gluwa/cc-next-query-builder';

import burnerAbi from './contract-abis/TestERC20Abi.json';
import simpleMinterAbi from './contract-abis/SimpleMinterUSC.json';

dotenv.config();

const main = async () => {
  console.log('Starting...');
  // Source chain contract address (ERC20 contract on source chain) where tokens are burned
  const sourceChainContractAddress = process.env.SOURCE_CHAIN_CONTRACT_ADDRESS;
  const sourceChainKey = Number(process.env.SOURCE_CHAIN_KEY || 102033);
  const sourceChainRpcUrl = process.env.SOURCE_CHAIN_RPC_URL;

  // Minter USC contract address on Creditcoin
  const uscMinterContractAddress = process.env.USC_MINTER_CONTRACT_ADDRESS;
  const ccNextRpcUrl = process.env.USC_TESTNET_RPC_URL;
  const ccNextWalletPrivateKey = process.env.USC_TESTNET_WALLET_PRIVATE_KEY;

  if (!sourceChainContractAddress) {
    throw new Error(
      'SOURCE_CHAIN_CONTRACT_ADDRESS environment variable is not configured or invalid'
    );
  }

  if (!uscMinterContractAddress) {
    throw new Error(
      'USC_BRIDGE_CONTRACT_ADDRESS environment variable is not configured or invalid'
    );
  }

  if (!sourceChainRpcUrl) {
    throw new Error(
      'SOURCE_CHAIN_RPC_URL environment variable is not configured or invalid'
    );
  }

  if (!ccNextRpcUrl) {
    throw new Error(
      'USC_TESTNET_RPC_URL environment variable is not configured or invalid'
    );
  }

  if (!ccNextWalletPrivateKey) {
    throw new Error(
      'USC_TESTNET_WALLET_PRIVATE_KEY environment variable is not configured or invalid'
    );
  }

  // 1. Setup your source chain block provider
  const ethProvider = new ethers.JsonRpcProvider(sourceChainRpcUrl);
  const blockProvider = new raw.blockProvider.SimpleBlockProvider(ethProvider);

  // 2. Setup your source chain continuity provider
  const ccProvider = new ethers.JsonRpcProvider(ccNextRpcUrl);
  const wallet = new ethers.Wallet(ccNextWalletPrivateKey, ccProvider);
  const continuityProvider = new raw.continuityProvider.PrecompileContinuityProvider(wallet);

  // 3. Using the above, create a proof generator
  const proofGenerator = new raw.RawProofGenerator(
    sourceChainKey,
    blockProvider,
    continuityProvider,
    EncodingVersion.V1,
  );

  // Instantiate source chain burner contract
  const burnerContract = new Contract(
    sourceChainContractAddress,
    burnerAbi as unknown as InterfaceAbi,
    ethProvider
  );

  // Instantiate minter contract on Creditcoin USC chain
  const minterContract = new Contract(
    uscMinterContractAddress,
    simpleMinterAbi as unknown as InterfaceAbi,
    wallet
  );

  // Listen to Minter events on USC chain
  const minterHandle = minterContract.on('TokensMinted', (contract, to, amount, queryId) => {
    console.log(`Tokens minted! Contract: ${contract}, To: ${to}, Amount: ${amount.toString()}, QueryId: ${queryId}`);
  });

  // Listen to Burn events on source chain
  const burnerHandle = burnerContract.on('TokensBurned', async (from, amount, payload: ContractEventPayload) => {
    // We validate that the event is from the wallet address we're monitoring and the contract we deployed
    const contractAddress = payload.log.address;
    if (from !== wallet.address || contractAddress !== sourceChainContractAddress) {
      return;
    }

    const txHash = payload.log.transactionHash;
    console.log(`Detected burn of ${amount.toString()} tokens from ${from} at ${txHash}`);
    // Here you would generate the proof and submit the query to Creditcoin USC chain
    // using the proofGenerator and minterContract instances created above

    let proof = await proofGenerator.generateProof(txHash);

    // Retry logic for proof generation
    let attempts = 10

    while (!proof.success && attempts > 0) {
      console.log(`Proof generation failed: ${proof.error}. Retrying in 30 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait before retrying

      const newProof = await proofGenerator.generateProof(txHash);
      if (newProof.success) {
        proof = newProof;
      }

      attempts--;
    }

    if (!proof.success) {
      console.error(`Failed to generate proof after multiple attempts: ${proof.error}`);
      return;
    }

    try {
      const proofData = proof.data!;
      const chainKey = proofData.chainKey;
      const height = proofData.headerNumber;
      const encodedTransaction = proofData.txBytes;
      const merkleRoot = proofData.merkleProof.root;
      const siblings = proofData.merkleProof.siblings;
      const lowerEndpointDigest = proofData.continuityProof.lowerEndpointDigest;
      const continuityBlocks = proofData.continuityProof.blocks;

      const response = await minterContract.mintFromQuery(
        chainKey,
        height,
        encodedTransaction,
        merkleRoot,
        siblings,
        lowerEndpointDigest,
        continuityBlocks,
      );
      console.log('Transaction submitted: ', response.hash);
    } catch (error) {
      console.error('Error submitting transaction: ', error);
      return;
    }
  });

  console.log('Worker started! Listening for burn events...');

  await Promise.all([burnerHandle, minterHandle]);
};

main().catch(console.error);
