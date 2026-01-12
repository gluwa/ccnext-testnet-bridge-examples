import { Contract, ethers, InterfaceAbi } from 'ethers';

import { api } from '@gluwa/cc-next-query-builder';

import simpleMinterAbi from './contract-abis/SimpleMinterUSC.json';

import axios from "axios";

// TODO: Update with deployed address on testnet
const USC_MINTER_CONTRACT_ADDRESS = '0x1d9b6d2E68555971138C1aE5b259BEF72E47a6D7';

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
  const proofResult = await generateProofWithRetry(
    proofGenServer,
    transactionHash,
    {
      maxAttempts: 20,   // ~4 minutes total
      delayMs: 15_000,
    }
  );

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
    const continuityRoots = proofData.continuityProof.roots;

    const response = await minterContract.mintFromQuery(
      chainKey,
      height,
      encodedTransaction,
      merkleRoot,
      siblings,
      lowerEndpointDigest,
      continuityRoots,
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

function isRetryableProverError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return err.response?.status === 503;
  }

  // Sometimes the library wraps the Axios error
  if (err instanceof Error) {
    return err.message.includes("status code 503");
  }

  return false;
}

async function generateProofWithRetry(
  proofGenServer: api.ProverAPIProofGenerator,
  txHash: string,
  {
    maxAttempts = 20,
    delayMs = 15_000, // 15 seconds
  } = {}
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Generating proof (attempt ${attempt}/${maxAttempts})...`);
      const result = await proofGenServer.generateProof(txHash);

      if (!result.success) {
        throw result.error;
      }

      return result;
    } catch (err) {
      lastError = err;

      if (!isRetryableProverError(err)) {
        // Non-503 → real failure, don’t retry
        throw err;
      }

      console.log(
        `Prover not ready yet (no attestation after tx height). ` +
        `Retrying in ${delayMs / 1000}s...`
      );

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw new Error(
    "Timed out waiting for prover attestation. " +
    "No attestation observed after the transaction height."
  );
}

main().catch(console.error);
