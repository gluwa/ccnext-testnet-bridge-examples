# Hello Bridge

This tutorial introduces you to one of the most common uses for a cross chain oracle, **cross chain
bridging!** Cross-chain bridging on Creditcoin can be broken down into three broad steps:

1. To begin, the `ERC20` tokens to bridge are burned using a smart contract on our _source chain_
   (in this case, Sepolia).
2. Then, we generate merkle and continuity proofs corresponding to our source chain token burn
3. Using the proofs we generated, we call our minter contract which will internally call the Creditcoin oracle's native proof verifier
4. After that the same contract will mint the tokens on Creditcoin

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

Start by heading to the `hello-bridge` folder:

```bash
cd hello-bridge
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

This tutorial involves the use of two different blockchains.

- Sepolia, which serves as our _source chain_ for the tutorial. This is where tokens are burned.
- Creditcoin USC Testnet, which serves as our _execution chain_ for the tutorial. This is where
  oracle queries are processed and where tokens are minted.

In order to use both blockchains we need to create a wallet and fund it with the native tokens of
both networks.

### 1.1 Generate a New Wallet Address

In order to safely sign transactions for this tutorial, we want to generate a fresh EVM wallet address.
Since all EVM networks use the same address and transaction signature scheme we can use the address we
create on both Sepolia and Creditcoin USC Testnet.

> [!CAUTION]
> In this tutorial, we will be using your wallet's private key to allow some test scripts to act on
> your wallet's behalf. Make sure the wallet you use contains nothing of value. Ideally it should be
> a newly created address.

Generating our new wallet is simple! Just run the following command:

```bash
cast wallet new
```

Save the resulting wallet address and private key for future use. They should look like:

<!-- ignore -->

```bash
Address:     0xBE7959cA1b19e159D8C0649860793dDcd125a2D5
Private key: 0xb9c179ed56514accb60c23a862194fa2a6db8bdeb815d16e2c21aa4d7dc2845d
```

### 1.2 Get some test funds (`Sepolia`)

Now that you have your new test address ready, you will be needing some funds to make transactions.
You can request some Sepolia ETH tokens using a [🚰 testnet faucet]. We link to the Google sepolia
faucet here.

### 1.3 Get some test funds (`Creditcoin`)

You will also need to fund your account on the Creditcoin Testnet, otherwise our oracle query
submission will fail due to lack of funds. Head to the [🚰 creditcoin discord faucet] to request
some test tokens there.

Your request for tokens in the Discord faucet should look like this. Substitute in your testnet
account address from [step 1.1]:

<!-- ignore -->

```bash
/faucet address: 0xBE7959cA1b19e159D8C0649860793dDcd125a2D5
```

Note, that currently the faucet yields 100 test CTC every 24 hours. This balance is sufficient
to submit 9 oracle queries, since testnet oracle fees are artificially high to prevent DOS.

Now that your wallet is ready to make transactions on both networks, you will be needing a way
to interact with it from the command line.

### 1.4 Obtaining an Infura API key

Finally, you will need a way to send requests to the Sepolia test chain. The easiest way to do this
is to sign up with an _RPC provider_. [Infura] will work for testing purposes.

Follow the onscreen instructions to create your account and generate your first api key. Make sure
you are requesting a Sepolia API key. Copy it: you will be needing it in the following steps. You
are now ready to go with the rest of the tutorial!

## 2. Minting some tokens on Sepolia

More tokens? But I thought I had all the tokens I needed! Well, kind of. For our example we
demonstrate burning ERC20 tokens rather than sepolia native tokens. Making an ERC20 contract call
to burn tokens and emitting a token burn event better demonstrates the best practice way of using
the Creditcoin Oracle described in our [DApp Design Patterns] Gitbook page.

But your new Sepolia account doesn't have these tokens yet!

For your convenience, we have [already deployed] a test `ERC20` contract to Sepolia which you can
use to mint some dummy ERC20 tokens. Run the following command:

<!-- env your_infura_api_key USC_DOCS_INFURA_KEY -->
<!-- env your_private_key USC_DOCS_TESTING_PK -->

```bash
cast send --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8                         \
    "mint(uint256)" 50000000000000000000                               \
    --private-key <your_private_key>
```

## 3. Burning the tokens you want to bridge

The first step in bridging tokens is to burn them on the _source chain_ (Sepolia in this case). We
burn tokens by transferring them to an address for which the private key is unknown, making them
inaccessible. This way, when creating the same amount of tokens on Creditcoin at the end of the
bridging process, we won't be creating any artificial value. Run the following command:

<!-- extract transaction_hash_from_step_3 "transactionHash\s*(0[xX][a-fA-F0-9]{64})" -->

```sh
cast send --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8                         \
    "burn(uint256)" 50000000000000000000                               \
    --private-key <your_private_key>
```

This should display some output stating that your transaction was a success, along with a
transaction hash:

<!-- ignore -->

```bash
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
```

Save the transaction hash. You will be needing it in the next step.

## 4. Submit a mint query to the USC contract

Great, we've burned some tokens! But how can we prove it? Most cross-chain bridges rely on a
_centralized_, _trusted_ approach: one service or company handles all the token burns on the _source
chain_ and is responsible for distributing the same amount of tokens on the target chain. This can
be an issue, since nothing is preventing that company from censoring certain transactions or even
stealing funds! Web3 was made to be _trustless_ and _decentralized_, let's make it that way 😎.

Now that we've burnt funds on Sepolia, we can use that transaction to request a mint in our USC contract, 
this also includes generating the proof for the Oracle using the Creditcoin proof generator library.

All these steps are condensed in the `submit_query` script, which is run as follows:

```sh
yarn submit_query                  \
    102033                         \
    <transaction_hash_from_step_3> \
    <your_private_key>
```

> [!TIP]
> If you submit a query within the first minute of conducting your token burn, it's possible that your query will fail. This is 
> because the Creditcoin Oracle takes up to a minute to attest to new blocks on a source chain. If your query fails 
> for this reason, wait a few seconds and try re-submitting it.

On a succesfull query, you should see some messages like the following from the script:

<!-- ignore -->

```sh
Transaction found in block 32: 0xb95b3b0ae14eb81eccd6203cc6479be46c0c578a440ac86c23e2de2411aed31f at index 0
Found attestation bounds for height 32: lower=10, upper=130
Built 100 continuity blocks for height 32
Transaction submitted:  0xf134fc29c12b22bb542da0393df527b40e1b772e71d87631b886bc8d14d594dd
Waiting for TokensMinted event...
Waiting for TokensMinted event...
Tokens minted! Contract: 0x0165878A594ca255338adfa4d48449f69242Eb8F, To: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, Amount: 1000, QueryId: 0x115e4c9437f48e8ae9795e7c828f56b6a738000aa06ac08e769375c5dc4f7bcc
Minting completed!
```

Sometimes it may take a bit more for the `TokensMinted` event to trigger, but should be no more than 30 seconds.

Once that's done we only need to check our newly minted tokens!

## 5. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that
the bridging process was successful.

Run the following command to query the contract:

<!-- env your_wallet_address USC_DOCS_TESTING_ADDRESS -->

```sh
yarn check_balance                             \
    0xCHANGEMELATER \
    <your_wallet_address>
```

You should get some output showing your wallet's balance on Creditcoin:

<!-- ignore -->

```bash
📦 Token: Mintable (TEST)
🧾 Raw Balance: 50000000000000000000
💰 Formatted Balance: 50.0 TEST
Decimals for token micro unit: 18
```

## Conclusion

Congratulations, you've bridged your first funds using the **Creditcoin Decentralized oracle!** This
is only a simple example of the cross chain functionality made possible by Creditcoin, keep on
reading to find more ways in which you can leverage decentralized cross-chain proofs of state!

In the next tutorial we will be looking at the next piece in the puzzle of decentralized bridging:
self-hosted smart contracts! In a production environment, the Creditcoin oracle will almost always
be used by teams of DApp builders who will handle data provisioning on behalf of their end users.
Such teams will want to define and deploy their own contracts as shown in the [custom contract
bridging] tutorial.

<!-- teardown "cd .." -->

[enable flakes]: https://nixos.wiki/wiki/flakes#Enable_flakes_temporarily
[yarn]: https://yarnpkg.com/getting-started/install
[foundry]: https://getfoundry.sh/
[🚰 testnet faucet]: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
[🚰 creditcoin discord faucet]: https://discord.com/channels/762302877518528522/1414985542235459707

<!-- markdown-link-check-disable -->

[Infura]: https://developer.metamask.io/register

<!-- markdown-link-check-enable -->

[already deployed]: https://sepolia.etherscan.io/address/0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8
[bridge contract]: https://explorer.usc-testnet.creditcoin.network/address/0x441726D6821B2009147F0FA96E1Ee09D412cCb38
[ERC20 contract]: https://explorer.usc-testnet.creditcoin.network/token/0xb0fb0b182f774266b1c7183535A41D69255937a3
[custom contract bridging]: ../custom-contracts-bridging/README.md
[step 1.1]: #11-generate-a-new-wallet-address
[step 2]: #2-minting-some-tokens-on-sepolia
[step 4]: #4-submit-a-mint-query-to-the-usc-contract
[DApp Design Patterns]: https://docs.creditcoin.org/usc/dapp-builder-infrastructure/dapp-design-patterns
