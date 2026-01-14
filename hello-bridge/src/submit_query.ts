import { Contract, ethers, InterfaceAbi } from 'ethers';

import { api, chainInfo } from '@gluwa/cc-next-query-builder';

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

    // Wait for attestation to be available
    const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL));
    // Use longer timeout (5 minutes) to handle cases where attestation takes longer
    await chainInfoProvider.waitUntilHeightAttested(chainKey, height, 5_000, 300_000);

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
    return err.response?.status === 404;
  }

  // Sometimes the library wraps the Axios error
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    // Check for various 404 error patterns
    return message.includes("404") ||
      message.includes("status code 404") ||
      message.includes("not found");
  }

  // Also check if error has a cause that is an Axios error
  if (err && typeof err === 'object' && 'cause' in err) {
    return isRetryableProverError((err as { cause: unknown }).cause);
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
        // Ensure we throw an Error instance for consistent handling
        const errorValue = result.error as unknown;
        const error = errorValue instanceof Error
          ? errorValue
          : new Error(String(result.error));
        throw error;
      }

      return result;
    } catch (err) {
      lastError = err;

      // Debug logging on first attempt
      if (attempt === 1) {
        console.error('Error details:', {
          type: typeof err,
          isError: err instanceof Error,
          isAxiosError: axios.isAxiosError(err),
          message: err instanceof Error ? err.message : String(err),
          isRetryable: isRetryableProverError(err),
        });
      }

      if (!isRetryableProverError(err)) {
        // Non-404 → real failure, don’t retry
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
