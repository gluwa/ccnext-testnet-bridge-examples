import { createPublicClient, createWalletClient, decodeEventLog, http } from "viem";
import { Chain } from "viem";
import readlineSync from 'readline-sync';
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import { QueryBuilder } from "./ethers-query-builder/query-builder/abi/QueryBuilder";
import { QueryableFields } from "./ethers-query-builder/query-builder/abi/models";
import { chainKeyConverter, computeQueryId } from "./utils";
import { PROVER_ABI } from "./constants/abi";
import { ChainQuery } from "./ethers-query-builder/models/ChainQuery";

async function main() {
  console.log('CCNext Query Builder:');
  // Setup
  // 1. Setup your source chain rpc
  // Prompt for RPC URL
  const rpcUrl = readlineSync.question('Enter Sepolia RPC URL (e.g., https://sepolia.infura.io/v3/<Your Infura API Key>): ').trim();
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    throw new Error('Invalid URL: must start with http:// or https://');
  }

  // Prompt for transaction hash
  const transactionHash = readlineSync.question('Enter the transaction hash (0x...): ');
  if (!transactionHash || !transactionHash.startsWith('0x') || transactionHash.length !== 66) {
    throw new Error('Invalid transaction hash provided');
  }

  // Prompt for CCNext Private Key
  const ccNextPrivateKey = readlineSync.question('Enter your CCNEXT account private key (0x...): ');
  if (!ccNextPrivateKey || !ccNextPrivateKey.startsWith('0x')) {
    throw new Error("Invalid private key provided");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 2. Setup your CCNext rpc and addresses
  const cc_next_local = {
    id: 42,
    name: 'CCNext-Devnet',
    nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
    rpcUrls: {
      default: {  
        http: ['https://rpc.ccnext-devnet.creditcoin.network']
      }
    },
    testnet: true
  } as const satisfies Chain;
  if (!ccNextPrivateKey) {
    throw new Error("CCNEXT_PRIVATE_KEY is not set");
  }
  const ccNextPublicClient = createPublicClient({
    chain: cc_next_local,
    transport: http(),
  });
  const ccNextWalletClient = createWalletClient({
    chain: cc_next_local,
    transport: http(),
    account: privateKeyToAccount(ccNextPrivateKey as `0x${string}`),
  });

  // Proving process
  // 1. Choose a transaction to query
  // Set your abi here
  const myErc20Abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},{"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}] as const;
  // 2. Build the query
  // We've developed a package for building queries in a type-safe way
  // That you can access in the ethers-query-builder folder
  // Once this is deployed officially, we'll remove the folder
  // Note that the query builder is supported for ethers V6 only
  console.log('Getting transaction and receipt');
  const tx = await provider.getTransaction(transactionHash);
  const receipt = await provider.getTransactionReceipt(transactionHash);

  if (!tx || !receipt) {
    throw new Error(`Missing transaction or receipt for ${transactionHash}`);
  }
  console.log('Building query');
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
  // This query format is necessary since this will be what the USC sees when it fetches the query result from the prover contract on CCNext
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
  await builder.eventBuilder("Transfer", () => true, b =>
    b.addAddress().addSignature().addArgument("from").addArgument("to").addArgument("value")
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
    height: BigInt(tx.blockNumber ?? (() => { throw new Error('Block number is null') })()),
    index: BigInt(receipt.index),
    layoutSegments: builder.build().map(f => ({
      offset: BigInt(f.offset),
      size: BigInt(f.size),
    })),
  };

  // 3. Calculate the cost of the query
  const proverContractAddress = '0xc1af0939ad5c9c193de0d64873736f09a53b4a92';
  // For each query, the prover contract expects us to pay a cost in CCNext native currency
  // This cost is for the heavy computation that the prover contract needs to perform
  // And the cost is calculated based on the query and the size of the query
  const computedQueryCost = await ccNextPublicClient.readContract({
    address: proverContractAddress as `0x${string}`,
    abi: PROVER_ABI,
    functionName: 'computeQueryCost',
    args: [query],
  });
  console.log(`Computed query cost: ${computedQueryCost}`);

  // 4. Submit the query to the CCNext prover
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
      ccNextWalletClient.account?.address! // This is the address that sends the query
    ],
    value: computedQueryCost,
  });

  // This is the actual transaction that will be submitted to the CCNext prover
  // And the transaction will be submitted to the CCNext prover
  const txHash = await ccNextWalletClient.writeContract(request);
  console.log(`Transaction submitted to the CCNext prover: ${txHash}`);

  
  const computedQueryId = computeQueryId(query);
  let stopListening = false;
  let startBlock = await ccNextPublicClient.getBlockNumber();
  console.log('===============================================')
  console.log('Waiting for prover events')
  console.log('===============================================')
  while (!stopListening) {
    const currentBlock = await ccNextPublicClient.getBlockNumber();

    const querySubmittedEvent = PROVER_ABI.find((abiElement) => abiElement.type === 'event' && abiElement.name === 'QuerySubmitted');
    const queryProofVerified = PROVER_ABI.find((abiElement) => abiElement.type === 'event' && abiElement.name === 'QueryProofVerified');
    const queryProofVerificationFailed = PROVER_ABI.find((abiElement) => abiElement.type === 'event' && abiElement.name === 'QueryProofVerificationFailed');
    const proverFilter = await ccNextPublicClient.createEventFilter({
      address: proverContractAddress as `0x${string}`,
      events: [querySubmittedEvent, queryProofVerified, queryProofVerificationFailed],
      fromBlock: BigInt(startBlock),
      toBlock: BigInt(currentBlock)
    });
    const proverLogs = await ccNextPublicClient.getFilterLogs({
      filter: proverFilter,
    })
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
          console.log(`Detected query submission event. Query processing underway. QueryId: ${decodedLog.args.queryId}`);
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
          console.log(`Query proving complete. QueryId: ${decodedLog.args.queryId}`);
          console.log(`Value return in event: ${JSON.stringify(decodedLog, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
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
          console.log(`Caught the query proof verification failed event: ${decodedLog.args.queryId}`);
          stopListening = true;
        }
      }
    }
    
    // Update block tracking and wait before next iteration
    console.log(`Listened from block ${startBlock} to ${currentBlock}`);
    startBlock = currentBlock + 1n;
    console.log(`Waiting to listen for more Prover events`);
    const uninstalledFilter = await ccNextPublicClient.uninstallFilter({
      filter: proverFilter,
    });
    if (!uninstalledFilter) {
      console.log('Failed to uninstall filter');
    }
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  console.log('===============================================')
  console.log(`Query Proving completed. QueryId: ${this.queryId}`)
  console.log('===============================================')
}
main().catch(console.error);
