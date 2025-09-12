import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
} from 'viem';
import { Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ethers } from 'ethers';
import { chainKeyConverter, computeQueryId } from './utils';
import { PROVER_ABI } from './constants/abi';
import erc20Abi from './contract-abis/TestERC20Abi.json';
import {
  ChainQuery,
  QueryBuilder,
  QueryableFields,
} from '@gluwa/cc-next-query-builder';

// Not all RPC nodes have the most recent blocks at the same time. This can cause
// events very near the head of the chain to be missed if http requests are sent
// to different RPC nodes due to the use of a load balancer. So we introduce a 
// block lag to ensure all RPC nodes have the same block history at the height
// we access.
const BLOCK_LAG: bigint = 3n;

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

  const [rpcUrl, transactionHash, ccNextPrivateKey] = args;

  // Validate RPC URL
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    throw new Error('Invalid URL: must start with http:// or https://');
  }

  // Validate Transaction Hash
  if (!transactionHash.startsWith('0x') || transactionHash.length !== 66) {
    throw new Error('Invalid transaction hash provided');
  }

  // Validate Private Key
  if (!ccNextPrivateKey.startsWith('0x')) {
    throw new Error('Invalid private key provided');
  }
  // 1. Setup your source chain rpc
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 2. Setup your CCNext rpc and addresses
  const cc_next_testnet = {
    id: 102033,
    name: 'CCNext-Testnet',
    nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
    rpcUrls: {
      default: {
        http: ['https://rpc.usc-testnet.creditcoin.network'],
      },
    },
    testnet: true,
  } as const satisfies Chain;
  if (!ccNextPrivateKey) {
    throw new Error('Creditcoin_Private_Key is not set');
  }
  const ccNextPublicClient = createPublicClient({
    chain: cc_next_testnet,
    transport: http(),
  });
  const ccNextWalletClient = createWalletClient({
    chain: cc_next_testnet,
    transport: http(),
    account: privateKeyToAccount(ccNextPrivateKey as `0x${string}`),
  });

  // Proving process
  // 1. Choose a transaction to query
  // Set your abi here
  const myErc20Abi = erc20Abi;
  // 2. Build the query
  // We've developed a package for building queries in a type-safe way
  // That you can access in the ethers-query-builder folder
  // Once this is deployed officially, we'll remove the folder
  // Note that the query builder is supported for ethers V6 only
  const tx = await provider.getTransaction(transactionHash);
  const receipt = await provider.getTransactionReceipt(transactionHash);

  if (!tx || !receipt) {
    throw new Error(`Missing transaction or receipt for ${transactionHash}`);
  }
  console.log('Building Creditcoin Oracle query');
  const builder = QueryBuilder.createFromTransaction(tx, receipt);
  // The idea of an Abi provider is that this will allow the query builder
  // to expect multiple events from different contracts
  // For now, in this example, we're only using one contract
  builder.setAbiProvider(async (contractAddress: string) => {
    // What ever contract address, we're always returning the string abi of erc20
    // Refer to example below for how to build queries with multiple events from different contracts
    return JSON.stringify(myErc20Abi);
  });
  // The format of the query can be customized
  // This query format is necessary since this will be what the USC sees when it fetches the query result from the prover contract on Creditcoin USC Testnet
  // In this case, here's the format of the query that the builder is setup
  // 0: Rx - Status (from addStaticField(RxStatus))
  // 1: Tx - From (from addStaticField(TxFrom))
  // 2: Tx - To (from addStaticField(TxTo))

  builder
    .addStaticField(QueryableFields.RxStatus)
    .addStaticField(QueryableFields.TxFrom)
    .addStaticField(QueryableFields.TxTo);
  // 3: Transfer Event - Address (contract emitting Transfer)
  // 4: Transfer Event - Signature
  // 5: Transfer Event - from (address sending the tokens)
  // 6: Transfer Event - to (address receiving the tokens)
  // 7: Transfer Event - value (amount of tokens transferred)
  await builder.eventBuilder(
    'Transfer',
    () => true,
    (b) =>
      b
        .addAddress()
        .addSignature()
        .addArgument('from')
        .addArgument('to')
        .addArgument('value')
  );

  const fields = builder.build();
  // The parameters that the prover contract expects
  // is the following
  // chainId: bigint - The converted chainId of the source chain which the prover expects
  // height: bigint - The block number of the source chain
  // index: bigint - The index of the transaction in the block
  // layoutSegments: { offset: bigint, size: bigint }[] - The layout of the query
  // The layoutSegments is an array of objects that contain the offset and size of the query
  // This is builted by the QueryBuilder
  // The offset is the starting index of the query
  // The size is the length of the query
  const query: ChainQuery = {
    chainId: chainKeyConverter(Number(tx.chainId)),
    height: BigInt(
      tx.blockNumber ??
        (() => {
          throw new Error('Block number is null');
        })()
    ),
    index: BigInt(receipt.index),
    layoutSegments: fields.map((f) => ({
      offset: BigInt(f.offset),
      size: BigInt(f.size),
    })),
  };

  // 3. Calculate the cost of the query
  const proverContractAddress = '0xc43402c66e88f38a5aa6e35113b310e1c19571d4';
  // For each query, the prover contract expects us to pay a cost in Creditcoin native currency
  // This cost is for the heavy computation that the prover contract needs to perform
  // And the cost is calculated based on the query and the size of the query
  const computedQueryCost = await ccNextPublicClient.readContract({
    address: proverContractAddress as `0x${string}`,
    abi: PROVER_ABI,
    functionName: 'computeQueryCost',
    args: [query],
  });
  console.log(`Computed query cost: ${computedQueryCost}`);

  // 4. Submit the query to the Creditcoin Oracle
  // Simulating the transaction before submitting it
  // This is to check if the transaction is valid
  // And to get the gas cost of the transaction
  const { request } = await ccNextPublicClient.simulateContract({
    address: proverContractAddress as `0x${string}`,
    account: ccNextWalletClient.account,
    abi: PROVER_ABI,
    functionName: 'submitQuery',
    args: [
      query,
      ccNextWalletClient.account?.address!, // This is the address that sends the query
    ],
    value: computedQueryCost,
  });

  // This is the actual transaction that will be submitted to the Creditcoin oracle
  // And the transaction will be submitted to the Creditcoin oracle
  const txHash = await ccNextWalletClient.writeContract(request);
  console.log(`Transaction submitted to the Creditcoin oracle: ${txHash}`);

  const computedQueryId = computeQueryId(query);
  let stopListening = false;
  let startBlock = await ccNextPublicClient.getBlockNumber();
  console.log('===============================================');
  console.log('Waiting for oracle proving results');
  while (!stopListening) {
    const currentBlock = await ccNextPublicClient.getBlockNumber();

    const querySubmittedEvent = PROVER_ABI.find(
      (abiElement) =>
        abiElement.type === 'event' && abiElement.name === 'QuerySubmitted'
    );
    const queryProofVerified = PROVER_ABI.find(
      (abiElement) =>
        abiElement.type === 'event' && abiElement.name === 'QueryProofVerified'
    );
    const queryProofVerificationFailed = PROVER_ABI.find(
      (abiElement) =>
        abiElement.type === 'event' &&
        abiElement.name === 'QueryProofVerificationFailed'
    );
    const proverFilter = await ccNextPublicClient.createEventFilter({
      address: proverContractAddress as `0x${string}`,
      events: [
        querySubmittedEvent,
        queryProofVerified,
        queryProofVerificationFailed,
      ],
      fromBlock: BigInt(startBlock),
      toBlock: BigInt(currentBlock),
    });
    const proverLogs = await ccNextPublicClient.getFilterLogs({
      filter: proverFilter,
    });
    for (const log of proverLogs) {
      const decodedLog = decodeEventLog({
        abi: PROVER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decodedLog.eventName === 'QuerySubmitted') {
        // 5. Listen to the prover's QuerySubmitted event
        // Normally you'll receive the queryId from which the prover hash from the query input
        // But you can also do that offchain
        // So that you know what queryId to expect from the incoming events
        if (decodedLog.args.queryId === computedQueryId) {
          console.log(
            `Detected query submission event. Query processing underway. QueryId: ${decodedLog.args.queryId}`
          );
          this.queryId = decodedLog.args.queryId;
        }
      }
      if (decodedLog.eventName === 'QueryProofVerified') {
        // 6. Listen to the prover's QueryProofVerified event
        // Once the prover has received the query, it will then further prove the query
        // Trying to make sure that the transaction the query is from actually happened on the source chain
        // You can read further into this from the prover mechanism article
        // Once the query is proven, the prover contract will emit a QueryProofVerified event
        // We just need to listen and catch the event with our queryId
        if (decodedLog.args.queryId === computedQueryId) {
          console.log(
            `Query proving complete. QueryId: ${decodedLog.args.queryId}`
          );
          //console.log(`Value return in event: ${JSON.stringify(decodedLog, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
          //const queryDetails = await ccNextPublicClient.readContract({
          //  address: proverContractAddress as `0x${string}`,
          //  abi: PROVER_ABI,
          //  functionName: 'getQueryDetails',
          //  args: [computedQueryId],
          //});
          //console.log(`Query details requested on demand: ${JSON.stringify(queryDetails, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
          stopListening = true;
        }
      }
      if (decodedLog.eventName === 'QueryProofVerificationFailed') {
        if (decodedLog.args.queryId === computedQueryId) {
          console.log(
            `Caught the query proof verification failed event: ${decodedLog.args.queryId}`
          );
          stopListening = true;
        }
      }
    }

    // Update block tracking and wait before next iteration
    startBlock = currentBlock + 1n;
    console.log(
      `Still waiting on prover events. Current block: ${currentBlock}`
    );
    const uninstalledFilter = await ccNextPublicClient.uninstallFilter({
      filter: proverFilter,
    });
    if (!uninstalledFilter) {
      console.log('Failed to uninstall filter');
    }
    if (stopListening == false) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }
  console.log('===============================================');
  console.log(`Query Proving completed. QueryId: ${this.queryId}`);
}
main().catch(console.error);
