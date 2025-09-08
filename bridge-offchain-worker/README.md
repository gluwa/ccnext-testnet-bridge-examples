# Bridge Offchain Worker

This example extends the `custom-contracts-bridging` tutorial by introducing a bridge offchain worker. The worker automates the query building and submitting process that we manually performed in our first 2 examples. The worker listens to events from three sources:

1. "burn" transfer events from our TestERC20 contract on Sepolia. Our worker needs to create an oracle query for each token burn detected.
2. "queryProofVerified" events from the query prover contract. Each of these events signals that a query has completed the oracle data provisioning process. When our worker detects that the query data has been provisioned, the worker submits a mint request to the bridge proxy contract we deployed on our Creditcoin USC chain. 
3. "mint" events from our bridge proxy contract, which tell us that the minting step is completed and we can drop any local records corresponding to the completed query.

# Tutorial Steps

## 0. Setup
Install the required packages and then add a .env file to configure the worker. For the contracts, you can put in the contract address you deployed by following this [tutorial](../custom-contracts-bridging/README.md)
```sh
yarn install
```

When filling in contract addresses in the .env file, make sure to use the addresses of the contracts you launched during the custom-contracts-bridging tutorial! The worker may not have the proper abi's available to run against contract addresses from the hello-bridge tutorial.

```env
# Source Chain Configuration
# SOURCE_CHAIN_INITIAL_START_BLOCK=<block_number>    # The starting block number to begin listening for burn events. If not provided, the worker will get the latest source chain block number
SOURCE_CHAIN_BLOCK_LAG=3                          # Number of blocks to wait before processing
SOURCE_CHAIN_CONTRACT_ADDRESS=<contract_address>   # Address of the ERC20 token contract on source chain
SOURCE_CHAIN_RPC_URL=<rpc_url>                     # RPC endpoint for the source chain. Following our previous example, this will be the Sepolia urls

# Creditcoin USC Chain Configuration
#CC_NEXT_INITIAL_START_BLOCK=<block_number>         # The starting block number to begin listening for prover events. If not provided, the worker will get the latest CC Next block number
CC_NEXT_BLOCK_LAG=3                               # Number of blocks to wait before processing
CC_NEXT_RPC_URL=<rpc_url>                          # RPC endpoint for the Creditcoin USC chain
CC_NEXT_ERC20_MINTABLE_ADDRESS=<contract_address>  # Address of the mintable ERC20 token on Creditcoin USC chain
CC_NEXT_WALLET_PRIVATE_KEY=<private_key>           # Private key of the wallet that will submit mint requests

# Contract Addresses
PROVER_CONTRACT_ADDRESS=0xc43402c66e88f38a5aa6e35113b310e1c19571d4         # Address of the prover contract on Creditcoin USC chain
USC_BRIDGE_CONTRACT_ADDRESS=<contract_address>     # Address of the bridge USC contract on Creditcoin USC chain

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
Creditcoin chain listener is listening from block 1298785 to 1299490
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
Worker job run 4
Source chain listener is listening from block 8963101 to 8963105
Found 1 new burn transaction events
Query cost: 3560 for query 0xa9c8d38267dcab19e06ff27a04457c07229168b7a9015c8084e16aa2b17d4d58
Transaction submitted to the Creditcoin oracle: 0x6a9a04b663998d1946846829b9a711c8c7d4c52dedb07c862fa768e96e6da027
...
```

The worker then waits for the prover contract to emit QueryProofVerified event to submit the mint transaction to the bridge USC:
```
...
Creditcoin listener is listening from block 1626782 to 1626793
Found 1 new prover contract result events
Caught the query proof verified event: 0xa9c8d38267dcab19e06ff27a04457c07229168b7a9015c8084e16aa2b17d4d58
Value return in event: {"eventName":"QueryProofVerified","args":{"queryId":"0xa9c8d38267dcab19e06ff27a04457c07229168b7a9015c8084e16aa2b17d4d58","resultSegments":[{"offset":"448","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"192","abiBytes":"0x000000000000000000000000016e7bfe4a7213e18516ca0cb84cf2750d360b33"},{"offset":"224","abiBytes":"0x0000000000000000000000008c4eddfea10aead7a29c00ada09e552b1c44af0c"},{"offset":"800","abiBytes":"0x0000000000000000000000008c4eddfea10aead7a29c00ada09e552b1c44af0c"},{"offset":"928","abiBytes":"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},{"offset":"960","abiBytes":"0x000000000000000000000000016e7bfe4a7213e18516ca0cb84cf2750d360b33"},{"offset":"992","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"1056","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000032"}],"state":2}}
Transaction submitted to the Creditcoin bridge USC: 0x21573f3d1f0507525c1bed89cabdd7031bada5c0c269ea226cbe247ca277fcc5
...
```
Finally the worker listens for the USC event where the mint is completed

```
...
Found 1 new bridge USC events
Caught the tokens minted event: 0xa9c8d38267dcab19e06ff27a04457c07229168b7a9015c8084e16aa2b17d4d58
Value return in event: {"eventName":"TokensMinted","args":{"token":"0xF90ae5240Cc4EbA6e96c97994d62874009Ad60F0","recipient":"0x016e7bFE4a7213E18516CA0Cb84Cf2750D360b33","queryId":"0xa9c8d38267dcab19e06ff27a04457c07229168b7a9015c8084e16aa2b17d4d58","amount":"50"}}
Congratulations! You've successfully bridged the tokens from source chain to your Creditcoin Chain!
...
```

## 4. Further reading
For design considerations and further explanation of this worker, see the Oracle Worker page in our official Universal Smart Contracts Gitbook: 
https://docs.creditcoin.org/usc/offchain-oracle-workers

## 5. Notes
If you configure these values SOURCE_CHAIN_INITIAL_START_BLOCK and CC_NEXT_INITIAL_START_BLOCK to blocks in the past, chances are you're going to revisit transactions and events that have been processed. The issue with this light worker is that it will always build and submit the queries as if the queries are first submitted. This will fail on the prover since the prover doesn't allow resubmission unless the query has failed or timed out on the prover contract.

TODO: Modify the query builder worker so that it uses the newly created `getQueryResult` prover function to check whether a query has already been processed before submitting it. Possibly still attempt to mint if a prior query result is available.

The bridge proxy contract acts similarly. It will revert mint calls for any queryId that has been submitted before.
```