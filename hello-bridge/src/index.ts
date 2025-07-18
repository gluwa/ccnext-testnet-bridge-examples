import { createPublicClient, createWalletClient, decodeEventLog, http } from "viem";
import { sepolia } from "viem/chains";
import { Chain } from "viem";
import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import { QueryBuilder } from "./ethers-query-builder/query-builder/abi/QueryBuilder";
import { QueryableFields } from "./ethers-query-builder/query-builder/abi/models";
import { chainKeyConverter, computeQueryId } from "./utils";
import { PROVER_ABI } from "./constants/abi";
import { ChainQuery } from "./ethers-query-builder/models/ChainQuery";

async function main() {
  console.log('Starting main function');
  // Load environment variables
  dotenv.config();
  console.log('Loading environment variables');
  // Setup
  // 1. Setup your source chain rpc
  const source_chain = {
    id: sepolia.id,
    name: sepolia.name,
    nativeCurrency: sepolia.nativeCurrency,
    rpcUrls: {
      default: {
        http: [process.env.SOURCE_CHAIN_RPC_URL || 'https://sepolia-test-proxy-rpc.creditcoin.network/'],
      },
    },
  };
  const sourceChainPublicClient = createPublicClient({
    chain: source_chain,
    transport: http(),
  });
  const provider = new ethers.JsonRpcProvider(process.env.SOURCE_CHAIN_RPC_URL || 'https://sepolia-test-proxy-rpc.creditcoin.network/');

  // 2. Setup your CCNext rpc and addresses
  const cc_next_local = {
    id: 42,
    name: 'CCNext-Devnet',
    nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
    rpcUrls: {
      default: {  
        http: [process.env.CCNEXT_RPC_URL || 'https://rpc.ccnext-devnet.creditcoin.network']
      }
    },
    testnet: true
  } as const satisfies Chain;
  const ccNextPrivateKey = process.env.CCNEXT_PRIVATE_KEY;
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

  // 3. Mint some ERC20 tokens and make a transfer
  // In this example, we're using a simple erc20 transfer transaction and we're querying the values in the function call as well as the events
  
  

  // Proving process
  // 1. Choose a transaction to query
  // Note that once a query is made of a transaction, you can't query it again unless it's been timed out
  // Because of this, to allow for multiple queries in this example
  // Please use a different ERC20 transfer transaction

  // Set your ERC20 transfer transaction hash
  const transactionHash = "0xf8330cbfd46840beb0e66b8a50010fc2d9464623020e0a3ab7944b2caec88f4b"; // <--- This is the transaction hash of the transfer
  console.log('Source chain transaction hash to query: ', transactionHash);
  const erc20Address = "0x296077f69435a073f7A6E0CBAEf8C1877633832E";
  // Set your abi here
  const myErc20Abi = [{"type":"constructor","inputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"allowance","inputs":[{"name":"owner","type":"address","internalType":"address"},{"name":"spender","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"approve","inputs":[{"name":"spender","type":"address","internalType":"address"},{"name":"value","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"nonpayable"},{"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"decimals","inputs":[],"outputs":[{"name":"","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},{"type":"function","name":"name","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},{"type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"transfer","inputs":[{"name":"to","type":"address","internalType":"address"},{"name":"value","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"nonpayable"},{"type":"function","name":"transferFrom","inputs":[{"name":"from","type":"address","internalType":"address"},{"name":"to","type":"address","internalType":"address"},{"name":"value","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"nonpayable"},{"type":"event","name":"Approval","inputs":[{"name":"owner","type":"address","indexed":true,"internalType":"address"},{"name":"spender","type":"address","indexed":true,"internalType":"address"},{"name":"value","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true,"internalType":"address"},{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"value","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"error","name":"ERC20InsufficientAllowance","inputs":[{"name":"spender","type":"address","internalType":"address"},{"name":"allowance","type":"uint256","internalType":"uint256"},{"name":"needed","type":"uint256","internalType":"uint256"}]},{"type":"error","name":"ERC20InsufficientBalance","inputs":[{"name":"sender","type":"address","internalType":"address"},{"name":"balance","type":"uint256","internalType":"uint256"},{"name":"needed","type":"uint256","internalType":"uint256"}]},{"type":"error","name":"ERC20InvalidApprover","inputs":[{"name":"approver","type":"address","internalType":"address"}]},{"type":"error","name":"ERC20InvalidReceiver","inputs":[{"name":"receiver","type":"address","internalType":"address"}]},{"type":"error","name":"ERC20InvalidSender","inputs":[{"name":"sender","type":"address","internalType":"address"}]},{"type":"error","name":"ERC20InvalidSpender","inputs":[{"name":"spender","type":"address","internalType":"address"}]}] as const;

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
  // 8: Function Calldata - Signature
  // 9: Function Calldata - from (address sending the tokens)
  // 10: Function Calldata - to (address receiving the tokens)
  await builder.functionBuilder("transfer", b => {
    b.addSignature().addArgument("to").addArgument("value");
  });

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
  console.log(`Query to submit: ${JSON.stringify(query, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

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
  console.log('Waiting for query submitted event');
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
          console.log(`Caught the query we submitted earlier: ${decodedLog.args.queryId}`);
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
          console.log(`Caught the query proof verified event: ${decodedLog.args.queryId}`);
          console.log(`Value return in event: ${JSON.stringify(decodedLog, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
          const queryDetails = await ccNextPublicClient.readContract({
            address: proverContractAddress as `0x${string}`,
            abi: PROVER_ABI,
            functionName: 'getQueryDetails',
            args: [computedQueryId],
          });
          console.log(`Query details requested on demand: ${JSON.stringify(queryDetails, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
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
    console.log(`Waiting for 30 seconds to start listening to prover events`);
    const uninstalledFilter = await ccNextPublicClient.uninstallFilter({
      filter: proverFilter,
    });
    if (uninstalledFilter) {
      console.log('Uninstalled filter');
    } else {
      console.log('Failed to uninstall filter');
    }
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  console.log('===============================================')
  console.log('Prover completed')
  console.log('===============================================')
}
main().catch(console.error);
