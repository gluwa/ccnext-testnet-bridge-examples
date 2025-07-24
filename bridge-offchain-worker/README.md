# CCNext Bridge Offchain Worker

This example extends the `custom-contracts-bridging` tutorial by introducing a bridge offchain worker. The worker automates the query building and submitting process that we manually performed in our first 2 examples. The worker listens to events from three sources:

1. "burn" transfer events from our TestERC20 contract on Sepolia. A CCNext our worker needs to create a bridging query for each token burn detected.
2. "queryProofVerified" events from the query prover contract. Each of these events signals that a query has completed the bridging process. When our worker detects that a query is done bridging, the worker submits a mint request to the bridge proxy contract we deployed on CCNext. 
3. "mint" events from our bridge proxy contract, which tell us that the minting step is completed and we can drop any local records corresponding to the completed query.

# Running the Worker

## 0. Setup
Install the required packages and then add a .env file to configure the worker. For the contracts, you can put in the contract address you deployed by following this [tutorial](../custom-contracts-bridging/README.md)
```sh
yarn install
```

```env
# Source Chain Configuration
SOURCE_CHAIN_INITIAL_START_BLOCK=<block_number>    # The starting block number to begin listening for burn events. If not provided, the worker will get the latest source chain block number
SOURCE_CHAIN_BLOCK_LAG=12                          # Number of blocks to wait before processing
SOURCE_CHAIN_CONTRACT_ADDRESS=<contract_address>   # Address of the ERC20 token contract on source chain
SOURCE_CHAIN_RPC_URL=<rpc_url>                     # RPC endpoint for the source chain. Following our previous example, this will be the Sepolia urls

# CCNext Configuration
CC_NEXT_INITIAL_START_BLOCK=<block_number>         # The starting block number to begin listening for prover events. If not provided, the worker will get the latest CC Next block number
CC_NEXT_BLOCK_LAG=12                               # Number of blocks to wait before processing
CC_NEXT_RPC_URL=<rpc_url>                          # RPC endpoint for the CCNext chain
CC_NEXT_ERC20_MINTABLE_ADDRESS=<contract_address>  # Address of the mintable ERC20 token on CCNext
CC_NEXT_WALLET_PRIVATE_KEY=<private_key>           # Private key of the wallet that will submit mint requests

# Contract Addresses
PROVER_CONTRACT_ADDRESS=<contract_address>         # Address of the prover contract on CCNext
USC_BRIDGE_CONTRACT_ADDRESS=<contract_address>     # Address of the bridge USC contract on CCNext

# Block Processing Configuration
MAX_BLOCK_RANGE=2000                               # Maximum number of blocks to process in each worker run
```

## 1. Run the worker
You can start the worker by running this command
```sh
yarn start_worker
```

Once running, the worker should be outputting these console logs
```
Starting...
Worker job run 1
Source chain listener is listening from block 8827111 to 8827396
Found 0 burn transaction events
Source chain listener part has finished
CCNext listener is listening from block 1298785 to 1299490
Found 0 prover contract result events
Found 0 bridge USC events
Worker job run 2
...
```

## 2. Make a burn transfer on source chain
Now that the worker is running, you can follow step 8 from [tutorial 2](../custom-contracts-bridging/README.md) to burn ERC20 tokens on Sepolia. After SOURCE_CHAIN_BLOCK_LAG blocks, the worker will catch the event and will build and submit the query right away.

## 3. Watch the worker run in the console
At this point, you will see the worker fully in action. First it listens for and handles events from the source chain:

```
...
Worker job 1th run
Source chain listener is listening from block 8827111 to 8827396
Found 1 burn transaction events
Query cost: 3560 for query 0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2
Source chain listener part has finished
...
```

The worker then waits for the prover contract to emit QueryProofVerified event to submit the mint transaction to the bridge USC:
```
...
CCNext listener is listening from block 1298785 to 1299490
Found 2 prover contract result events
Caught the query we submitted earlier: 0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2
Caught the query proof verified event: 0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2
Value return in event: {"eventName":"QueryProofVerified","args":{"queryId":"0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2","resultSegments":[{"offset":"448","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"192","abiBytes":"0x0000000000000000000000002fabaffc7f6426c1beedec22cc150a7dbe6667fb"},{"offset":"224","abiBytes":"0x000000000000000000000000296077f69435a073f7a6e0cbaef8c1877633832e"},{"offset":"800","abiBytes":"0x000000000000000000000000296077f69435a073f7a6e0cbaef8c1877633832e"},{"offset":"928","abiBytes":"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},{"offset":"960","abiBytes":"0x0000000000000000000000002fabaffc7f6426c1beedec22cc150a7dbe6667fb"},{"offset":"992","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"1056","abiBytes":"0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"}],"state":2}}
Query details requested on demand: {"state":2,"query":{"chainId":"6","height":"8827206","index":"12","layoutSegments":[{"offset":"448","size":"32"},{"offset":"192","size":"32"},{"offset":"224","size":"32"},{"offset":"800","size":"32"},{"offset":"928","size":"32"},{"offset":"960","size":"32"},{"offset":"992","size":"32"},{"offset":"1056","size":"32"}]},"escrowedAmount":"0","principal":"0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0","estimatedCost":"3560","timestamp":"1753301165","resultSegments":[{"offset":"448","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"192","abiBytes":"0x0000000000000000000000002fabaffc7f6426c1beedec22cc150a7dbe6667fb"},{"offset":"224","abiBytes":"0x000000000000000000000000296077f69435a073f7a6e0cbaef8c1877633832e"},{"offset":"800","abiBytes":"0x000000000000000000000000296077f69435a073f7a6e0cbaef8c1877633832e"},{"offset":"928","abiBytes":"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},{"offset":"960","abiBytes":"0x0000000000000000000000002fabaffc7f6426c1beedec22cc150a7dbe6667fb"},{"offset":"992","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"1056","abiBytes":"0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"}]}
...
```
Finally the worker listens for the USC event where the mint is completed

```
...
Found 1 bridge USC events
Caught the tokens minted event: 0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2
Value return in event: {"eventName":"TokensMinted","args":{"token":"0x4cd9262F0375634c903DF8a8c670F44C401aDB60","recipient":"0x2FabAFfC7F6426C1beEdec22cc150A7dBE6667FB","queryId":"0xca1bb35adb6e35662e57e58ccf4d3fd959b5d93a469caf720736ba99a8ffacf2","amount":"1000000000000000000"}}
...
```

## 4. Notes
If you configure these values SOURCE_CHAIN_INITIAL_START_BLOCK and CC_NEXT_INITIAL_START_BLOCK to blocks in the past, chances are you're going to revisit transactions and events that have been processed. The issue with this light worker is that it will always build and submit the queries as if the queries are first submitted. This will fail on the prover since the prover doesn't allow resubmission unless the query has failed or timed out on the prover contract.

TODO: Modify the query builder worker so that it uses the newly created `getQueryResult` prover function to check whether a query has already been processed before submitting it. Possibly still attempt to mint if a prior query result is available.

The bridge proxy contract acts similarly. It will revert mint calls for any queryId that has been submitted before.
```