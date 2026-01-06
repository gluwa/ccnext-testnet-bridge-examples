import { Contract, ethers, InterfaceAbi } from 'ethers';

import { api } from '@gluwa/cc-next-query-builder';

import simpleMinterAbi from './contract-abis/SimpleMinterUSC.json';

// TODO: Update with deployed address on testnet
const USC_MINTER_CONTRACT_ADDRESS = '0x9cEfa7025C6093965230868e48d61ff6f616958C';

const PROVER_API_URL = 'https://proof-gen-api.usc-devnet.creditcoin.network';
const CREDITCOIN_RPC_URL = 'https://rpc.usc-devnet.creditcoin.network';

async function main() {
  // Setup
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error(`
  Usage:
    yarn submit_query <Transaction_Hash> <Creditcoin_Private_Key>

  Example:
    yarn submit_query 0xabc123... 0xYOURPRIVATEKEY
  `);
    process.exit(1);
  }

  const [transactionHash, ccNextPrivateKey] = args;
  // TODO: Change this to 1 once this script is targeting testnet
  const chainKey = 3;

  // Validate Transaction Hash
  if (!transactionHash.startsWith('0x') || transactionHash.length !== 66) {
    throw new Error('Invalid transaction hash provided');
  }

  // Validate Private Key
  if (!ccNextPrivateKey.startsWith('0x') || ccNextPrivateKey.length !== 66) {
    throw new Error('Invalid private key provided');
  }

  // 1. Estabnlish connection to proof generation API Server
  const proofGenServer = new api.ProverAPIProofGenerator(chainKey, PROVER_API_URL);

  // 2. Build proof using the generator
  const proofResult = await proofGenServer.generateProof(transactionHash);
  if (!proofResult.success) {
    throw new Error(`Failed to generate proof: ${proofResult.error}`);
  }

  // 3. Establish link with the USC contract
  const ccProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
  const wallet = new ethers.Wallet(ccNextPrivateKey, ccProvider);
  const contractABI = simpleMinterAbi as unknown as InterfaceAbi;
  const minterContract = new Contract(USC_MINTER_CONTRACT_ADDRESS, contractABI, wallet);

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
