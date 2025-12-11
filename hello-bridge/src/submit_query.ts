import { Contract, ethers, InterfaceAbi } from 'ethers';

import { EncodingVersion, raw } from '@gluwa/cc-next-query-builder';

import simpleMinterAbi from './contract-abis/SimpleMinterUSC.json';

// TODO: Update with deployed address on testnet
const USC_MINTER_CONTRACT_ADDRESS = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';

async function main() {
  // Setup
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.error(`
  Usage:
    yarn submit_query <Sepolia_RPC_URL> <Transaction_Hash> <Creditcoin_Private_Key>

  Example:
    yarn submit_query https://sepolia.infura.io/v3/YOUR_KEY 0xabc123... 0xYOURPRIVATEKEY
  `);
    process.exit(1);
  }

  var [rpcUrl, transactionHash, ccNextPrivateKey] = args;

  // Validate RPC URL
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    throw new Error('Invalid URL: must start with http:// or https://');
  }

  // Validate Transaction Hash
  if (!transactionHash.startsWith('0x')) {
    transactionHash = '0x' + transactionHash;
  }

  if (transactionHash.length !== 66) {
    throw new Error('Invalid transaction hash provided');
  }

  // Validate Private Key
  if (!ccNextPrivateKey.startsWith('0x')) {
    ccNextPrivateKey = '0x' + ccNextPrivateKey;
  }

  if (ccNextPrivateKey.length != 66) {
    throw new Error('Invalid private key provided');
  }

  // 1. Setup your source chain block provider
  const ethProvider = new ethers.JsonRpcProvider(rpcUrl);
  const blockProvider = new raw.blockProvider.SimpleBlockProvider(ethProvider);

  // 2. Setup your source chain continuity provider
  const testnetRpcUrl = 'https://rpc.usc-testnet.creditcoin.network';
  const ccProvider = new ethers.JsonRpcProvider(testnetRpcUrl);
  const wallet = new ethers.Wallet(ccNextPrivateKey, ccProvider);
  const continuityProvider = new raw.continuityProvider.PrecompileContinuityProvider(wallet);

  // 3. Using the above, create a proof generator
  const sepoliaChainKey = 102033;
  const proofGenerator = new raw.RawProofGenerator(
    sepoliaChainKey,
    blockProvider,
    continuityProvider,
    EncodingVersion.V1,
  );

  // 4. Build proof using the generator
  const proofResult = await proofGenerator.generateProof(transactionHash);
  if (!proofResult.success) {
    throw new Error(`Failed to generate proof: ${proofResult.error}`);
  }

  // 5. Establish link with the USC contract
  const contractABI = simpleMinterAbi as unknown as InterfaceAbi;
  const minterContract = new Contract(USC_MINTER_CONTRACT_ADDRESS, contractABI, wallet);

  let eventTriggered = false;

  // Prepare to listen to the TokensMinted event
  minterContract.on('TokensMinted', (contract, to, amount, queryId) => {
    console.log(`Tokens minted! Contract: ${contract}, To: ${to}, Amount: ${amount.toString()}, QueryId: ${queryId}`);

    eventTriggered = true;
  });

  // 6. Submit the proof to the USC contract to mint tokens
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
    return;
  }

  // 7. Wait for the TokensMinted event
  while (!eventTriggered) {
    console.log('Waiting for TokensMinted event...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  }

  console.log('Minting completed!');

  process.exit(0);
}

main().catch(console.error);
