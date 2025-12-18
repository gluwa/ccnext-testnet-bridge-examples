# Bridge Offchain Worker

> [!TIP]
> This tutorial builds on the previous [Custom Contract Bridging] example -make sure to check it out
> before moving on!

So far we have seen [how to initiate a trustless bridge transaction] and
[how to customize our trustless bridging logic]. In this tutorial, we will be seeing how to automate
our interaction with the Creditcoin oracle so that end users only have to submit _a single transaction_
on the Sepolia _source chain_.

## What is an Offchain Worker

An Offchain Worker is a script responsible for watching the state of a _source chain_: in this
case, Sepolia. In more complex cases this would also listen to state changes on the Creditcoin execution chain. The worker queries to our 
_Universal Smart Contract_ on Creditcoin in response to specific events on
each chain. With an offchain worker, all the end user needs to do is sign a single transaction
on the source chain kicking off cross-chain interaction.

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

# Address of the ERC20 token contract on source chain
SOURCE_CHAIN_CONTRACT_ADDRESS=<test_erc20_contract_address_from_custom_contracts_bridging>

# Chain identifier of the source chain on Creditcoin, for Sepolia it would be 1
SOURCE_CHAIN_KEY=<source_chain_key>

# RPC endpoint for the source chain. Following our previous example, this will
# be the Sepolia urls
SOURCE_CHAIN_RPC_URL=https://sepolia.infura.io/v3/<your_infura_api_key>

# ============================================================================ #
#                      Creditcoin USC Chain Configuration                      #
# ============================================================================ #

# RPC endpoint for the Creditcoin USC chain
USC_TESTNET_RPC_URL=https://rpc.usc-testnet.creditcoin.network

# Address of the minter contract on Creditcoin
USC_MINTER_CONTRACT_ADDRESS=<erc20_minter_address_from_custom_contracts_bridging>

# Private key of the wallet that will submit mint requests
USC_TESTNET_WALLET_PRIVATE_KEY=<your_private_key>
```

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
Worker started! Listening for burn events...
```

## 3. Burning the tokens you want to bridge

Like we did in the previous tutorials, we start the bridging process by burning the funds we want to
bridge on Sepolia. This time however this will be the only transaction we need to submit! The rest
will be handled automatically by the worker 🤖

Run the following command to initiate the burn:

<!-- env your_infura_api_key USC_DOCS_INFURA_KEY -->
<!-- env your_private_key USC_DOCS_TESTING_PK -->
<!-- alias test_erc20_contract_address_from_step_2 test_erc20_contract_address_from_custom_contracts_bridging -->

```sh
cast send --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    <test_erc20_contract_address_from_custom_contracts_bridging>       \
    "burn(uint256)" 50000000000000000000                               \
    --private-key <your_private_key>
```

> [!TIP]
> If your worker is not running when the transaction is being processed on the source chain it will not pick up
> the event! This example is made for simplicity, a more robust worker would be able to read events from
> previous blocks and have more complex event filters.

## 4. Monitor the Offchain Worker

At this point, you should see the worker picking up the event.

<!-- ignore -->

```bash
Detected burn of 1000 tokens from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 at 0x49537972ceb6bb8308252474e14847253c4bdf74e87c2ab53cb8e29eea9f5719
Transaction found in block 596: 0xa2f465f09f0cbb95bd202e9fe303c48d1badceadfac3a577e28b726658321287 at index 0
Proof generation failed: Failed to build continuity proof: Cannot build continuity proof for height 596 without both lower and upper bounds. Retrying in 30 seconds...
```

> [!TIP]
> Notice how the logs show an error failing to build the continuity proof. Don't be alarmed! This is due to the
> fact that the Creditcoin chain still hasn' t attested to the block in which the transaction took place.
> The worker will keep retrying this until the proof will is succesfully built and submitted!

Eventually, you should see a message like this one:

<!-- ignore -->

```bash
Tokens minted! Contract: 0x0165878A594ca255338adfa4d48449f69242Eb8F, To: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, Amount: 1000, QueryId: 0x115e4c9437f48e8ae9795e7c828f56b6a738000aa06ac08e769375c5dc4f7bcc
```

That's it! All it took was a single transaction on your end to initiate the bridging process,
providing for a _truly native UX_.

## 5. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that
the bridging process was successful.

Run the following command to check your funds:

<!-- env your_wallet_address USC_DOCS_TESTING_ADDRESS -->
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
[USC Gitbook]: https://docs.creditcoin.org/usc
