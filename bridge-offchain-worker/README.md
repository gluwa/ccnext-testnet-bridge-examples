# Bridge Offchain Worker

> [!TIP]
> This tutorial builds on the previous [Custom Contract Bridging] example -make sure to check it out
> before moving on!

So far we have seen [how to initiate a trustless bridge transaction] and 
[how to customize our trustless bridging logic]. In this tutorial, we will be seeing how to automate 
our interaction with the Creditcoin oracle so that end users only have to submit _a single transaction_ 
on the Sepolia _source chain_.

## What is an Offchain Worker

An Offchain Worker is an script responsible for watching the state of a _source chain_ (in this
case, Sepolia) as well as the Creditcoin _execution chain_. It submits _oracle queries_ and
interacts with our _Universal Smart Contract_ on Creditcoin in response to specific events on 
each chain. With an offchain worker, all the end user needs to do is sign a single transaction
on the source chain kicking off cross-chain interaction.

Our offchain worker will listen to events from the following sources:

1. `burn` transfer events which are emitted by our test `ERC20` contract on Sepolia. When our worker
   detects this, they create an oracle query to request a proof of the token burn from the
   Creditcoin Decentralized Oracle.

2. `queryProofVerified` events which are emitted by the prover contract on Creditcoin. Each of
   these events signals that a query has finished being proven by the Creditcoin Decentralized
   Oracle. When our worker detects this, it submits a request to our _bridge proxy contract_ to
   finalize the bridging process by minting the tokens we burned on Sepolia onto Creditcoin.

3. `mint` events which are emitted by our _bridge proxy contract_. This signals that all bridged
   tokens have finished minting and we can drop any local records related to the bridged
   transaction.

## External dependencies

To continue with this tutorial, you will first need to have the following dependencies available
locally:

- [yarn]
- [foundry]

<!-- ignore -->
> [!TIP]
> This project provides a `flake.nix` you can use to download all the dependencies you will need for
> this tutorial inside of a sandboxed environment. Just keep in mind you will have to
> **[enable flakes]** for this to work. To start you development environment, simply run:
>
> ```bash
> nix develop
> ```

Start by heading to the `bridge-offchain-worker` folder:

```bash
cd bridge-offchain-worker
```

You will need to set up the right version of foundry with `foundryup`:

<!-- ignore -->
```bash
foundryup --version v1.2.3 # Skip this command if you are using nix!

```

And download the required packages with `yarn`:

```sh
yarn
```

## 1. Setup

This is the same as in [Hello Bridge]. If you have not already done so, follow the installation
steps in the [setup] section there.

Once that is done, you will need to set up some additional configuration for the offchain worker.
Save and edit the following to a `.env` file inside of `bridge-offchain-worker/`:

<!-- ignore -->
```env
# ============================================================================ #
#                          Source Chain Configuration                          #
# ============================================================================ #

# The starting block number to begin listening for burn events. If not provided,
# the worker will get the latest source chain block number
# SOURCE_CHAIN_INITIAL_START_BLOCK=<block_number>

# Number of blocks to wait before processing events
SOURCE_CHAIN_BLOCK_LAG=3

# Address of the ERC20 token contract on source chain
SOURCE_CHAIN_CONTRACT_ADDRESS=<test_erc20_contract_address_from_custom_contracts_bridging>

# RPC endpoint for the source chain. Following our previous example, this will
# be the Sepolia urls
SOURCE_CHAIN_RPC_URL=https://sepolia.infura.io/v3/<your_infura_api_key>

# ============================================================================ #
#                      Creditcoin USC Chain Configuration                      #
# ============================================================================ #

# The starting block number to begin listening for prover events. If not
# provided, the worker will get the latest USC Testnet block number
#USC_TESTNET_INITIAL_START_BLOCK=<block_number>

# Number of blocks to wait before processing
USC_TESTNET_BLOCK_LAG=3

# RPC endpoint for the Creditcoin USC chain
USC_TESTNET_RPC_URL=https://rpc.usc-testnet.creditcoin.network

# Address of the mintable ERC20 token on Creditcoin USC chain
USC_TESTNET_ERC20_MINTABLE_ADDRESS=<erc20_mintable_address_from_custom_contracts_bridging>

# Private key of the wallet that will submit mint requests
USC_TESTNET_WALLET_PRIVATE_KEY=<your_private_key>

# ============================================================================ #
#                              Contract Addresses                              #
# ============================================================================ #

# Address of the prover contract on Creditcoin USC chain
PROVER_CONTRACT_ADDRESS=0xc43402c66e88f38a5aa6e35113b310e1c19571d4

# Address of the proxy bridge contract on Creditcoin USC chain
USC_BRIDGE_CONTRACT_ADDRESS=<universal_bridge_proxy_address_from_custom_contracts_bridging>

# ============================================================================ #
#                        Block Processing Configuration                        #
# ============================================================================ #

# Maximum number of blocks to process in each worker run
MAX_BLOCK_RANGE=2000
```

> [!CAUTION]
> If you configure `SOURCE_CHAIN_INITIAL_START_BLOCK` and `USC_TESTNET_INITIAL_START_BLOCK` to point
> to blocks in the past, chances are you're going to re-query transactions and events that have
> already been processed. The issue with the example worker we are using is that it will always
> build and submit queries as if this was the first time they are being submitted. **This will fail
> on the prover** since it doesn't allow query resubmissions. **The bridge proxy contract acts
> similarly**, in that it will revert mint calls for any query id that has been already been
> submitted.

## 2. Start the Offchain Worker

Once you have your worker configured, it's time to start automating some queries!

Run the following command to start the worker:

<!-- ignore -->
```sh
yarn start_worker
```

Once it's up and running, you start to see the following logs:

<!-- ignore -->
```bash
Starting...
Worker job run 1
Source chain listener is listening from block 8827111 to 8827396
Creditcoin chain listener is listening from block 1298785 to 1299490
Worker job run 2
...
```

> [!TIP]
> The prover can take a bit of time to get started. Sit back and wait until you get the full log
> output as shown above ☕

## 4. Burning the tokens you want to bridge

Like we did in the previous tutorials, we start the bridging process by burning the funds we want to
bridge on Sepolia. This time however this will be the only transaction we need to submit! The rest
will be handled automatically by the worker 🤖

Run the following command to initiate the burn:

<!-- env your_infura_api_key INFURA_API_KEY -->
<!-- env your_private_key PRIVATE_KEY -->
<!-- alias test_erc20_contract_address_from_step_2 test_erc20_contract_address_from_custom_contracts_bridging -->
```sh
cast send --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    <test_erc20_contract_address_from_custom_contracts_bridging>       \
    "burn(uint256)" 50000000000000000000                               \
    --private-key <your_private_key>
```

> [!TIP]
> It can take some time for the worker to pick up your transaction. Pay attention to your
> transaction's `blockNumber`: the prover will pick it up when that block number falls into the
> range of blocks it is listening to on the source chain ☕

## 4. Monitor the Offchain Worker

At this point, you should see the worker start to process some events and requesting a proof of your
token burn from the Creditcoin Decentralized Oracle:

<!-- ignore -->
```bash
...
Source chain listener is listening from block 9159981 to 9159985
Found 2 new burn transaction events
Skipping non-burn transfer: tx=0xa6d0aa852fb1cead707be7fae0c6c3678dd5dcb33ec09327606d53079a8e3039, from=0x0000000000000000000000000000000000000000, to=0x475CFf3D6728B0BaEdDd65d863DD7E82a43367ee, value=50000
Query cost: 10000000000000000000 for query 0x45778684817c53de254036b8bfe975dd16b93a36f320c7de3f88ae107bf8a2b0
Query submitted to the Creditcoin oracle: 0x3aa3b0e4f99524f087bb0257b339f3ed1ff7d8ca9ea0c03660577468911e26ae
...
```

The worker then waits for the prover contract to emit a `QueryProofVerified` event notifying it that
the query has been processed. It then queries the _bridging proxy contract_ on Creditcoin to initate
the minting process:

<!-- ignore -->
```bash
...
Creditcoin USC chain listener is listening from block 69063 to 69066
Found 1 new prover contract result events
Caught the query proof verified event: 0x45778684817c53de254036b8bfe975dd16b93a36f320c7de3f88ae107bf8a2b0
Value return in event: {"eventName":"QueryProofVerified","args":{"queryId":"0x45778684817c53de254036b8bfe975dd16b93a36f320c7de3f88ae107bf8a2b0","resultSegments":[{"offset":"448","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"192","abiBytes":"0x000000000000000000000000475cff3d6728b0baeddd65d863dd7e82a43367ee"},{"offset":"224","abiBytes":"0x00000000000000000000000015166ba9d24abfa477c0c88dd1e6321297214ec8"},{"offset":"800","abiBytes":"0x00000000000000000000000015166ba9d24abfa477c0c88dd1e6321297214ec8"},{"offset":"928","abiBytes":"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"},{"offset":"960","abiBytes":"0x000000000000000000000000475cff3d6728b0baeddd65d863dd7e82a43367ee"},{"offset":"992","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000001"},{"offset":"1056","abiBytes":"0x0000000000000000000000000000000000000000000000000000000000000032"}],"state":2}}
Transaction submitted to the Creditcoin bridge USC: 0x30a57a9f51a36d954e4ae4939589ad8298bdd54d1d69a02485918bfc54d4828e
...
```

Finally, the worker listens for the `mint` event notifying it that the tokens have been minted to
our account on Creditcoin.

<!-- ignore -->
```bash
...
Found 1 new bridge USC events
Caught the tokens minted event: 0x45778684817c53de254036b8bfe975dd16b93a36f320c7de3f88ae107bf8a2b0
Value return in event: {"eventName":"TokensMinted","args":{"token":"0xb0fb0b182f774266b1c7183535A41D69255937a3","recipient":"0x475CFf3D6728B0BaEdDd65d863DD7E82a43367ee","queryId":"0x45778684817c53de254036b8bfe975dd16b93a36f320c7de3f88ae107bf8a2b0","amount":"50"}}
Congratulations! You've successfully bridged tokens from your source chain to your Creditcoin chain!
...
```

That's it! All it took was a single transaction on your end to initiate the bridging process,
providing for a _truly native UX_.

## 5. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that
the bridging process was successful.

Run the following command to check your funds:

<!-- env your_wallet_address PUBLIC_KEY -->
<!-- alias erc20_mintable_address_from_step_3_2 erc20_mintable_address_from_custom_contracts_bridging -->
```sh
yarn check_balance                                          \
    <erc20_mintable_address_from_custom_contracts_bridging> \
    <your_wallet_address>
```

If you've been going through the previous tutorials, your balance should now
be:

<!-- ignore -->
```bash
📦 Token: Mintable (TEST)
🧾 Raw Balance: 200000000000000000000
💰 Formatted Balance: 200 TEST
```

## Conclusion

Congratulations! You've completed the Creditcoin Universal Smart Contracts tutorial series!
You've learned:

1. How to interact with the Creditcoin Oracle
2. How to deploy your own custom Universal Smart Contracts
3. How to run an offchain worker to support smooth cross-chain user experience

If you haven't already, take a look at the [USC Gitbook] for more information.

<!-- teardown "cd .." -->

[enable flakes]: https://nixos.wiki/wiki/flakes#Enable_flakes_temporarily
[yarn]: https://yarnpkg.com/getting-started/install
[foundry]: https://getfoundry.sh/
[Custom Contract Bridging]: ../custom-contracts-bridging/README.md
[how to initiate a trustless bridge transaction]: ../hello-bridge/README.md
[how to customize our trustless bridging logic]: ../custom-contracts-bridging/README.md
[Hello Bridge]: ../hello-bridge/README.md
[setup]: ../hello-bridge/README.md#1-setup
[test contract]: https://sepolia.etherscan.io/address/0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8
[USC Gitbook]: https://docs.creditcoin.org/usc
