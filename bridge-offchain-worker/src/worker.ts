import dotenv from 'dotenv';
import { Cron } from 'croner';
import { JsonRpcProvider } from 'ethers';
import { chainKeyConverter, computeQueryId } from './utils';
import proverAbi from './contract-abis/prover.json';
import uscBridgeAbi from './contract-abis/USCBridge.json';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  isAddressEqual,
  PublicClient,
} from 'viem';
import erc20Abi from './contract-abis/erc20.json';
import { PROVER_ABI } from '../../hello-bridge/src/constants/abi';
import { Abi } from 'abitype/zod';
import { privateKeyToAccount } from 'viem/accounts';
import {
  QueryBuilder,
  QueryableFields,
  ChainQuery,
} from '@gluwa/cc-next-query-builder';

dotenv.config();

interface WorkerData {
  sourceChainStartBlock: bigint;
  sourceChainEndBlock: bigint | undefined;
  ccNextStartBlock: bigint;
  ccNextEndBlock: bigint | undefined;
  sourceChainRun: number;
  ccNextRun: number;
  sourceChainBlockLag: bigint;
  ccNextBlockLag: bigint;
  sourceChainContractAddress: string;
  trackedQueryIds: `0x${string}`[];
  completedQueryIds: `0x${string}`[];
}

// Discriminated union type for block range processing
type BlockRangeResult =
  | { shouldListen: false }
  | { shouldListen: true; startBlock: bigint; endBlock: bigint };

const getBlockRangeToProcess = async (
  startBlock: bigint,
  blockLag: bigint,
  maxBlockRange: bigint,
  publicClient: PublicClient
): Promise<BlockRangeResult> => {
  const currentBlock = await publicClient.getBlockNumber();
  // Have to accomodate at least blockLag blocks ahead of the start block
  if (currentBlock < startBlock + blockLag) {
    return {
      shouldListen: false,
    };
  }

  const endBlock =
    currentBlock - blockLag < startBlock + maxBlockRange
      ? currentBlock - blockLag
      : startBlock + maxBlockRange;
  return {
    shouldListen: true,
    startBlock: startBlock,
    endBlock: endBlock,
  };
};

const burnTransactionQueryBuilder = async (
  transactionHash: string,
  sourceChainProvider: JsonRpcProvider
): Promise<{ query: ChainQuery; queryId: `0x${string}` }> => {
  const tx = await sourceChainProvider.getTransaction(transactionHash);
  const receipt =
    await sourceChainProvider.getTransactionReceipt(transactionHash);

  if (!tx || !receipt) {
    throw new Error(`Missing transaction or receipt for ${transactionHash}`);
  }

  const builder = QueryBuilder.createFromTransaction(tx, receipt);
  builder.setAbiProvider(async (contractAddress: string) => {
    return JSON.stringify(erc20Abi);
  });

  // The format of the query can be customized
  // This query format is necessary since this will be what the USC sees when it fetches the query result from the prover contract on Creditcoin USC chain
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
  const query: ChainQuery = {
    chainId: chainKeyConverter(Number(tx.chainId)),
    height: BigInt(
      tx.blockNumber ??
        (() => {
          throw new Error('Block number is null');
        })()
    ),
    index: BigInt(receipt.index),
    layoutSegments: builder.build().map((f) => ({
      offset: BigInt(f.offset),
      size: BigInt(f.size),
    })),
  };

  const queryId = computeQueryId(query);

  return { query, queryId };
};

const overRunProtectionCallback = (job) =>
  console.log(
    `Call at ${new Date().toISOString()} were blocked by call started at ${job.currentRun().toISOString()}`
  );

const main = async () => {
  console.log('Starting...');

  // Validate environment variables
  const sourceChainStartBlock = Number(
    process.env.SOURCE_CHAIN_INITIAL_START_BLOCK
  );
  const ccNextStartBlock = Number(process.env.CC_NEXT_INITIAL_START_BLOCK);
  const sourceChainBlockLag = BigInt(
    process.env.SOURCE_CHAIN_BLOCK_LAG || '12'
  );
  const ccNextBlockLag = BigInt(process.env.CC_NEXT_BLOCK_LAG || '12');
  const maxBlockRange = BigInt(process.env.MAX_BLOCK_RANGE || '2000');
  const sourceChainContractAddress = process.env.SOURCE_CHAIN_CONTRACT_ADDRESS;
  const proverContractAddress = process.env.PROVER_CONTRACT_ADDRESS;
  const uscBridgeContractAddress = process.env.USC_BRIDGE_CONTRACT_ADDRESS;
  const sourceChainRpcUrl = process.env.SOURCE_CHAIN_RPC_URL;
  const ccNextRpcUrl = process.env.CC_NEXT_RPC_URL;
  const ccNextWalletPrivateKey = process.env.CC_NEXT_WALLET_PRIVATE_KEY;
  const ccNextErc20MintableAddress = process.env.CC_NEXT_ERC20_MINTABLE_ADDRESS;

  if (!sourceChainContractAddress) {
    throw new Error(
      'SOURCE_CHAIN_CONTRACT_ADDRESS environment variable is not configured or invalid'
    );
  }

  if (!proverContractAddress) {
    throw new Error(
      'PROVER_CONTRACT_ADDRESS environment variable is not configured or invalid'
    );
  }

  if (!uscBridgeContractAddress) {
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
      'CC_NEXT_RPC_URL environment variable is not configured or invalid'
    );
  }

  if (!ccNextWalletPrivateKey) {
    throw new Error(
      'CC_NEXT_WALLET_PRIVATE_KEY environment variable is not configured or invalid'
    );
  }

  if (!ccNextErc20MintableAddress) {
    throw new Error(
      'CC_NEXT_ERC20_MINTABLE_ADDRESS environment variable is not configured or invalid'
    );
  }

  const sourceChainPublicClient = createPublicClient({
    transport: http(sourceChainRpcUrl),
  });
  const ccNextPublicClient = createPublicClient({
    transport: http(ccNextRpcUrl),
  });
  const ccNextWalletClient = createWalletClient({
    transport: http(ccNextRpcUrl),
    account: privateKeyToAccount(ccNextWalletPrivateKey as `0x${string}`),
  });

  const provider = new JsonRpcProvider(process.env.SOURCE_CHAIN_RPC_URL);

  const sourceChainCurrentBlock =
    await sourceChainPublicClient.getBlockNumber();
  const ccNextCurrentBlock = await ccNextPublicClient.getBlockNumber();

  const data: WorkerData = {
    sourceChainStartBlock: sourceChainStartBlock
      ? BigInt(sourceChainStartBlock)
      : sourceChainCurrentBlock - sourceChainBlockLag,
    sourceChainEndBlock: undefined,
    ccNextStartBlock: ccNextStartBlock
      ? BigInt(ccNextStartBlock)
      : ccNextCurrentBlock - ccNextBlockLag,
    ccNextEndBlock: undefined,
    sourceChainRun: 0,
    ccNextRun: 0,
    sourceChainBlockLag: sourceChainBlockLag,
    ccNextBlockLag: ccNextBlockLag,
    sourceChainContractAddress: sourceChainContractAddress,
    trackedQueryIds: [],
    completedQueryIds: [],
  };
  const workerJob = new Cron(
    '* * * * *',
    { context: data, protect: overRunProtectionCallback },
    async (self, context) => {
      const contextData = context as WorkerData;
      contextData.sourceChainRun++;
      console.log(`Worker job run ${contextData.sourceChainRun}`);
      // Source chain listener job
      const blockRange = await getBlockRangeToProcess(
        contextData.sourceChainStartBlock,
        contextData.sourceChainBlockLag,
        maxBlockRange,
        sourceChainPublicClient
      );
      if (blockRange.shouldListen) {
        console.log(
          `Source chain listener is listening from block ${blockRange.startBlock} to ${blockRange.endBlock}`
        );
        const erc20TransferEvent = erc20Abi.find(
          (abi) => abi.name === 'Transfer'
        );
        const erc20SourceChainFilter =
          await sourceChainPublicClient.createEventFilter({
            address: sourceChainContractAddress as `0x${string}`,
            event: erc20TransferEvent,
            fromBlock: blockRange.startBlock,
            toBlock: blockRange.endBlock,
          });
        const logs = await sourceChainPublicClient.getFilterLogs({
          filter: erc20SourceChainFilter,
        });
        if (logs.length > 0) {
          console.log(`Found ${logs.length} new burn transaction events`);
        }

        for (const log of logs) {
          const decodedLog = decodeEventLog({
            abi: erc20Abi,
            data: log.data,
            topics: log.topics,
          });

          if (decodedLog.eventName == 'Transfer') {
            const { from, to, value } = decodedLog.args;
            if (
              !isAddressEqual(
                to,
                '0x0000000000000000000000000000000000000000'
              ) &&
              !isAddressEqual(to, '0x0000000000000000000000000000000000000001')
            ) {
              console.log(
                `Skipping non-burn transfer: tx=${log.transactionHash}, from=${from}, to=${to}, value=${value}`
              );
              continue;
            }
          }
          const { query, queryId } = await burnTransactionQueryBuilder(
            log.transactionHash,
            provider
          );
          contextData.trackedQueryIds.push(queryId);

          // Send query to Creditcoin USC Chain
          const queryCost = await ccNextPublicClient.readContract({
            address: proverContractAddress as `0x${string}`,
            abi: PROVER_ABI,
            functionName: 'computeQueryCost',
            args: [query],
          });
          console.log(`Query cost: ${queryCost} for query ${queryId}`);

          const { request } = await ccNextPublicClient.simulateContract({
            address: proverContractAddress as `0x${string}`,
            account: ccNextWalletClient.account,
            abi: PROVER_ABI,
            functionName: 'submitQuery',
            args: [query, ccNextWalletClient.account?.address!],
            value: queryCost,
          });

          // This is the actual transaction that will be submitted to the Creditcoin oracle/prover
          const txHash = await ccNextWalletClient.writeContract(request);
          console.log(`Query submitted to the Creditcoin oracle: ${txHash}`);
        }

        contextData.sourceChainStartBlock = blockRange.endBlock + BigInt(1);
      } else {
        console.log(
          'Source chain listener has caught up. Job is not listening'
        );
      }

      // CCNext listener part (prover contract)
      const viemUscBridgeAbi = Abi.parse(uscBridgeAbi);
      const viemProverAbi = Abi.parse(proverAbi);
      const ccNextBlockRange = await getBlockRangeToProcess(
        contextData.ccNextStartBlock,
        contextData.ccNextBlockLag,
        maxBlockRange,
        ccNextPublicClient
      );
      if (ccNextBlockRange.shouldListen) {
        console.log(
          `Creditcoin USC chain listener is listening from block ${ccNextBlockRange.startBlock} to ${ccNextBlockRange.endBlock}`
        );
        const querySubmittedEvent = viemProverAbi.find(
          (abiElement) =>
            abiElement.type === 'event' && abiElement.name === 'QuerySubmitted'
        );
        const queryProofVerifiedEvent = viemProverAbi.find(
          (abiElement) =>
            abiElement.type === 'event' &&
            abiElement.name === 'QueryProofVerified'
        );
        const proverFilter = await ccNextPublicClient.createEventFilter({
          address: proverContractAddress as `0x${string}`,
          events: [querySubmittedEvent, queryProofVerifiedEvent],
          fromBlock: ccNextBlockRange.startBlock,
          toBlock: ccNextBlockRange.endBlock,
        });
        const proverLogs = await ccNextPublicClient.getFilterLogs({
          filter: proverFilter,
        });
        if (proverLogs.length > 0) {
          console.log(
            `Found ${proverLogs.length} new prover contract result events`
          );
        }

        for (const log of proverLogs) {
          const decodedLog = decodeEventLog({
            abi: viemProverAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decodedLog.eventName === 'QuerySubmitted') {
            if (contextData.trackedQueryIds.includes(decodedLog.args.queryId)) {
              console.log(
                `Query we submitted earlier is now in Creditcoin block: ${decodedLog.args.queryId}`
              );
            }
          }
          if (decodedLog.eventName === 'QueryProofVerified') {
            if (contextData.trackedQueryIds.includes(decodedLog.args.queryId)) {
              console.log(
                `Caught the query proof verified event: ${decodedLog.args.queryId}`
              );
              console.log(
                `Value return in event: ${JSON.stringify(decodedLog, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`
              );

              // Stop tracking query so we don't re-submit it
              contextData.trackedQueryIds = contextData.trackedQueryIds.filter(
                (query) => query !== decodedLog.args.queryId
              );

              const queryDetails = await ccNextPublicClient.readContract({
                address: proverContractAddress as `0x${string}`,
                abi: PROVER_ABI,
                functionName: 'getQueryDetails',
                args: [decodedLog.args.queryId],
              });
              // Full query details can be useful for debugging, but are overkill for tutorial runs
              //console.log(`Query details requested on demand: ${JSON.stringify(queryDetails, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

              const { request } = await ccNextPublicClient.simulateContract({
                abi: uscBridgeAbi,
                address: uscBridgeContractAddress as `0x${string}`,
                functionName: 'uscBridgeCompleteMint',
                account: ccNextWalletClient.account,
                args: [
                  proverContractAddress,
                  decodedLog.args.queryId,
                  ccNextErc20MintableAddress as `0x${string}`,
                ],
              });
              const txHash = await ccNextWalletClient.writeContract(request);
              console.log(
                `Transaction submitted to the Creditcoin bridge USC: ${txHash}`
              );
            }
          }
        }

        // Listen to bridge usc events
        const tokensMinted = viemUscBridgeAbi.find(
          (e) => e.type === 'event' && e.name === 'TokensMinted'
        );
        const uscFilter = await ccNextPublicClient.createEventFilter({
          address: uscBridgeContractAddress as `0x${string}`,
          events: [tokensMinted],
          fromBlock: ccNextBlockRange.startBlock,
          toBlock: ccNextBlockRange.endBlock,
        });
        const uscLogs = await ccNextPublicClient.getFilterLogs({
          filter: uscFilter,
        });
        if (uscLogs.length > 0) {
          console.log(`Found ${uscLogs.length} new bridge USC events`);
        }

        for (const log of uscLogs) {
          const decodedLog = decodeEventLog({
            abi: viemUscBridgeAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decodedLog.eventName === 'TokensMinted') {
            console.log(
              `Caught the tokens minted event: ${decodedLog.args.queryId}`
            );
            console.log(
              `Value return in event: ${JSON.stringify(decodedLog, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`
            );
            contextData.completedQueryIds.push(decodedLog.args.queryId);
            console.log(
              `Congratulations! You've successfully bridged tokens from your source chain to your Creditcoin chain!`
            );
            console.log('Exiting Offchain Worker...');
          }

          // FIXME: offchain worker is having trouble handling events after this point
          return;
        }
        contextData.ccNextStartBlock = ccNextBlockRange.endBlock + BigInt(1);
      } else {
        console.log(
          'Creditcoin chain listener has caught up. Job is not listening'
        );
      }
    }
  );
};
main().catch(console.error);
