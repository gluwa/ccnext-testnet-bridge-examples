# Custom Contract Bridging

> [!TIP]
> This tutorial builds on the previous [Hello Bridge] example -make sure to check it out before
> moving on!

Now that you have performed your first _trustless bridge transaction_, let's keep going with the next
step: this tutorial teaches you how to set up your own custom bridging logic by deploying your own
smart contracts!

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

Start by heading to the `custom-contracts-bridging` folder:

```bash
cd custom-contracts-bridging
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

## 2. Deploy A Test `ERC20` Contract on Sepolia

Let's start by deploying our own `ERC20` contract on Sepolia. The contract contains logic for
tracking the balances of a coin called `TEST`. The contract also automatically funds its creator's
address with 1000 `TEST` coins, so we won't have to mint `TEST` tokens manually.

Run the following command to deploy the contract:

<!-- env your_infura_api_key USC_DOCS_INFURA_KEY -->
<!-- env your_private_key USC_DOCS_TESTING_PK -->
<!-- extract test_erc20_contract_address_from_step_2 "Deployed to: (0[xX][a-fA-F0-9]{40})" -->
```sh
forge create                                                     \
    --broadcast                                                  \
    --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    --private-key <your_private_key> \
    TestERC20
```

This should display some output containing the address of your test `ERC20` contract:

<!-- ignore -->
```bash
Deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

Save the contract address. You will be needing it in the next step.

## 3. Deploy Your Own Custom Bridging Contracts

In the next few steps we will be deploying our own bridging contracts based off the
`CCNext-smart-contracts` repository. This repository contains templates for the two smart contracts
we will be deploying on Creditcoin USC Testnet:

- `UniversalBridgeProxy.sol`
- `ERC20Mintable.sol`

Universal smart contracts (USCs) such as `UniversalBridgeProxy` are intended to be deployed by DApp 
builders. Here, our USC is used only for bridging tokens. A USC retrieves cross-chain data from 
oracle query results. It then interprets that data into typed values, and uses the typed cross-chain 
data to call further DApp business logic.

For instance, our `UniversalBridgeProxy` looks for fields like `from`, `to`, and `amount` in the
oracle proof we submit to it. With those fields, the contract can verify whether or not a token
burn took place, how many tokens it needs to mint on Creditcoin, and which address it should mint
them to.

Our other contract, `ERC20Mintable`, is only used to mint our newly bridged tokens. It is modified
so that its `_mint()` function can be called by the our `UniversalBridgeProxy` contract.

Start by cloning the `CCNext-smart-contracts` repository:

```sh
git clone https://github.com/gluwa/CCNext-smart-contracts.git
cd CCNext-smart-contracts
git checkout 382aa218889af6ac484cfe33018f1f9e6866cdcf
```

### 3.1 Modify The Bridge Smart Contract

As an exercise, we will be modifying our `UniversalBridgeProxy` so that it mints _twice_ the amount
of tokens which were burned on our _source chain_.

> [!NOTE]
> This is for demonstration purposes only, as bridging this way dilutes the value of our `TEST` 
> token each time we bridge it.

In your freshly cloned `CCNext-smart-contracts` repository, start by opening the file
`contracts/UniversalBridgeProxy.sol`. Next, navigate to the following line inside of the
`uscBridgeCompleteMint` function:

```sol
_mintTokens(ERC20Address, fromAddress, amount, queryId);
```

Update it so that your `UniversalBridgeProxy` contract mints twice
the `amount` of tokens it should on Creditcoin. The resulting line should look something like:

```sol
_mintTokens(ERC20Address, fromAddress, amount * 2, queryId);
```

### 3.2 Deploy Your Modified Contracts

To deploy your modified bridging contracts, start by creating a `.env` file at the top-level of the
`CCNext-smart-contracts` repository. Run the following command to setup your `.env`:

```bash
echo OWNER_PRIVATE_KEY=<your_private_key> > .env
```

Next, compile your bridging smart contracts:

```bash
npm install && npx hardhat compile
```

<!-- ignore -->
> [!CAUTION]
> If you get an error like:
>
> ```bash
> * Invalid account: #0 for network: cc3_usc_testnet - private key too short, expected 32 bytes
> ```
>
> That means you forgot to set your `.env`!

Finally, deploy your contracts using the following command:

<!-- extract erc20_mintable_address_from_step_3_2 "ERC20 deployed to: (0[xX][a-fA-F0-9]{40})" -->
<!-- env your_wallet_address USC_DOCS_TESTING_ADDRESS -->
<!-- extract universal_bridge_proxy_address_from_step_3_2 "UniversalBridgeProxy deployed to: (0[xX][a-fA-F0-9]{40})" -->
```bash
npx hardhat deploy                          \
    --network cc3_usc_testnet               \
    --proceedsaccount <your_wallet_address> \
    --erc20name Test                        \
    --erc20symbol TEST                      \
    --chainkey 102033                       \
    --timeout 300                           \
    --lockupduration 86400                  \
    --approvalthreshold 2                   \
    --maxinstantmint 100                    \
    --admin <your_wallet_address>
```

> [!TIP]
> This can take a bit of time ☕

You should get some output with the address of the contracts you just deployed:

<!-- ignore -->
```bash
ERC20 deployed to: 0x7d8726B05e4A48850E819639549B50beCB893506
UniversalBridgeProxy deployed to: 0x4858Db7F085418301A010c880B98374d83533fa2
```

Save the address of each contract. You will be needing them in [step 6]. Remember to exit the
`CCNext-smart-contracts` repository and return to the `custom-contracts-bridging` folder:

```bash
cd ..
```

## 4. Burning the tokens you want to bridge

The following few steps are similar to what we did in the [Hello Bridge] example. Start by burning
the tokens you want to bridge on the _source chain_ (Sepolia in this case). We will be burning the
`TEST` tokens from the test `ERC20` contract which we deployed in [step 2]. We do this by
transferring them to an address for which the private key is unknown, making them inaccessible.

Run the following command to initiate the burn:

<!-- extract transaction_hash_from_step_4 "transactionHash\s*(0[xX][a-fA-F0-9]{64})" -->
```bash
cast send                                                        \
    --rpc-url https://sepolia.infura.io/v3/<your_infura_api_key> \
    <test_erc20_contract_address_from_step_2>                    \
    "burn(uint256)" 50000000000000000000                         \
    --private-key <your_private_key>
```

This should display some output stating that your transaction was a success, along with a
transaction hash:

<!-- ignore -->
```bash
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
```

Save the transaction hash. You will be needing it in the next step.

## 5. Get a proof of the token burn from the Creditcoin Oracle

Now that we've burnt funds on Sepolia, we need to create a proof of that token burn using the
Creditcoin Decentralized Oracle. We do this by submitting an _oracle query_. Run the following
command:

<!-- extract query_id_from_step_5 "Query Proving completed. QueryId: (0[xX][a-fA-F0-9]{64})" -->
```sh
yarn submit_query                                      \
    https://sepolia.infura.io/v3/<your_infura_api_key> \
    <transaction_hash_from_step_4>                     \
    <your_private_key>
```

> [!TIP]
> This will take a while. Sit back, relax, and wait for the query to process ☕ Proving should take
> ~16 minutes and no more than 30 minutes.

Once the proving process completes, you should see some output stating that your query was proven
successfully, along with a query id:

<!-- ignore -->
```bash
Query Proving completed. QueryId: 0x7ee33a2be05c9019dedcd833c9c2fa516c2bd316b225dd7ca3bde5b1cdb987db
```

Save the query id. You will be needing it in the next step.

## 6. Mint Tokens on Creditcoin

Now that we have a proof of the token burn on our _source chain_, we can finalize the bridging
process by minting the same amount of tokens on the Creditcoin testnet. To do that, we need to call
the function `uscBridgeCompleteMint` in your `UniversalBridgeProxy` contract on Creditcoin. This 
will fetch and interpret cross-chain data from our _trustlessly_ verified proof created in [step 5].

Run the following command to query the proxy contract:

```sh
yarn complete_mint                               \
    <your_private_key> \
    <universal_bridge_proxy_address_from_step_3_2> \
    0xc43402c66e88f38a5aa6e35113b310e1c19571d4   \
    <query_id_from_step_5>                       \
    <erc20_mintable_address_from_step_3_2>
```

Congratulations, you've just set up and used your very own _trustless bridge_!

## 7. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that
the bridging process was successful. This will use the `ERC20Mintable` contract which you deployed
in [step 3.2].

Run the following command to query the contract:

```sh
yarn check_balance                        \
    <erc20_mintable_address_from_step_3_2> \
    <your_wallet_address>
```

You should get some output showing your wallet's balance on Creditcoin:

<!-- ignore -->
```bash
📦 Token: Mintable (TEST)
🧾 Raw Balance: 100000000000000000000
💰 Formatted Balance: 100.0 TEST
```

Notice how you now have _twice_ the amount of tokens you originally burned on Sepolia!

## Conclusion

Congratulations! You've set up your first custom smart contracts which make use of the Creditcoin
Decentralized Oracle!

The next tutorial will take another important step towards developing a mature, production ready 
cross-chain DApp. That step is automation! We automate using an **offchain worker** which submits 
oracle queries and triggers use of oracle results. This _vastly_ improves UX by making it so the 
end user only has to sign a _single_ transaction to initiate the bridging procedure.

In practice, DApp builders will want to conduct all cross-chain queries via an offchain worker in
order to ensure robustness and streamline UX. Checkout the [bridge offchain worker] tutorial next
for more information!

<!-- teardown "cd .." -->

[Hello Bridge]: ../hello-bridge/README.md
[setup]: ../hello-bridge/README.md#1-setup
[yarn]: https://yarnpkg.com/getting-started/install
[foundry]: https://getfoundry.sh/
[enable flakes]: https://nixos.wiki/wiki/flakes#Enable_flakes_temporarily
[step 2]: #2-deploy-a-test-erc20-contract-on-sepolia
[step 3.2]: #32-deploy-your-modified-contracts
[step 5]: #5-get-a-proof-of-the-token-burn-from-the-creditcoin-oracle
[step 6]: #6-mint-tokens-on-creditcoin
[bridge offchain worker]: ../bridge-offchain-worker/README.md
