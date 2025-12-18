import { Contract, ethers, InterfaceAbi } from 'ethers';

import { api } from '@gluwa/cc-next-query-builder';

import simpleMinterAbi from './contract-abis/SimpleMinterUSC.json';

const PROVER_API_URL = 'https://proof-gen-api.usc-devnet.creditcoin.network';
const CREDITCOIN_RPC_URL = 'https://rpc.usc-devnet.creditcoin.network';

async function main() {
  // Setup
  const args = process.argv.slice(2);

  if (args.length !== 4) {
    console.error(`
  Usage:
    yarn submit_query <Sepolia_Chain_Key> <Transaction_Hash> <Creditcoin_Private_Key> <Minter_Contract_Address>

  Example:
    yarn submit_query 1 0xabc123... 0xYOURPRIVATEKEY 0xMinterContractAddress
  `);
    process.exit(1);
  }

  const [chainKey, transactionHash, ccNextPrivateKey, minterAddress] = args;

  // Validate Chain Key
  const chainKeyNum = parseInt(chainKey, 10);
  if (isNaN(chainKeyNum) || chainKeyNum <= 0) {
    throw new Error('Invalid chain key provided');
  }

  // Validate Transaction Hash
  if (!transactionHash.startsWith('0x') || transactionHash.length !== 66) {
    throw new Error('Invalid transaction hash provided');
  }

  // Validate Private Key
  if (!ccNextPrivateKey.startsWith('0x') || ccNextPrivateKey.length !== 66) {
    throw new Error('Invalid private key provided');
  }

  // Validate Minter Contract Address
  if (!minterAddress.startsWith('0x') || minterAddress.length !== 42) {
    throw new Error('Invalid minter contract address provided');
  }

  // 1. Estabnlish connection to prover API
  const proofGenerator = new api.ProverAPIProofGenerator(
    chainKeyNum,
    PROVER_API_URL
  );

  // 2. Build proof using the generator
  const proofResult = await proofGenerator.generateProof(transactionHash);
  if (!proofResult.success) {
    throw new Error(`Failed to generate proof: ${proofResult.error}`);
  }

  // 3. Establish link with the USC contract
  const ccProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const wallet = new ethers.Wallet(ccNextPrivateKey, ccProvider);
  const contractABI = simpleMinterAbi as unknown as InterfaceAbi;
  const minterContract = new Contract(minterAddress, contractABI, wallet);

  let eventTriggered = false;

  // Prepare to listen to the TokensMinted event
  minterContract.on('TokensMinted', (contract, to, amount, queryId) => {
    console.log(`Tokens minted! Contract: ${contract}, To: ${to}, Amount: ${amount.toString()}, QueryId: ${queryId}`);

    eventTriggered = true;
  });

  // 4. Submit the proof to the USC contract to mint tokens
  try {
    const proofData = proofResult.data!;
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

    process.exit(1);
  }

  // 5. Wait for the TokensMinted event
  while (!eventTriggered) {
    console.log('Waiting for TokensMinted event...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  }

  console.log('Minting completed!');

  process.exit(0);
}

main().catch(console.error);
