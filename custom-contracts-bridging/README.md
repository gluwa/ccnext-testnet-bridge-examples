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
`CCNext-smart-contracts` repository. This repository contains the template for the smart contract
we will be deploying on Creditcoin USC Testnet:

- `SimpleMinterUSC.sol`

Universal smart contracts (USCs) such as `SimpleMinterUSC` are intended to be deployed by DApp
builders. Here, our USC is used only for bridging tokens. A USC retrieves cross-chain data from
oracle query results. It then interprets that data into typed values, and uses the typed cross-chain
data to call further DApp business logic.

For instance, our `SimpleMinterUSC` looks for fields like `from`, `to`, and `amount` in the
oracle proof we submit to it. With those fields, the contract can verify whether or not a token
burn took place, how many tokens it needs to mint on Creditcoin, and which address it should mint
them to.

Start by cloning the `CCNext-smart-contracts` repository:

```sh
git clone https://github.com/gluwa/CCNext-smart-contracts.git
cd CCNext-smart-contracts
git checkout CHANGEMELATER
```

### 3.1 Modify The Bridge Smart Contract

As an exercise, we will be modifying our `SimpleMinterUSC` so that it mints _twice_ the amount
of tokens which were burned on our _source chain_.

> [!NOTE]
> This is for demonstration purposes only, as bridging this way dilutes the value of our `TEST`
> token each time we bridge it.

In your freshly cloned `CCNext-smart-contracts` repository, start by opening the file
`contracts/SimpleMinterUSC.sol`. Next, navigate to the following line inside of the
`mintFromQuery` function:

```sol
_mint(msg.sender, MINT_AMOUNT);
```

Update it so that your `SimpleMinterUSC` contract mints twice
the `MINT_AMOUNT` of tokens it should on Creditcoin. The resulting line should look something like:

```sol
_mint(msg.sender, MINT_AMOUNT * 2);
```

### 3.2 Deploy Your Modified Contract

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
    --chainkey 1                       \
    --timeout 300                           \
    --lockupduration 86400                  \
    --approvalthreshold 2                   \
    --maxinstantmint 100                    \
    --admin <your_wallet_address>
```

> [!TIP]
> This can take a bit of time ☕

You should get some output with the address of the contract you just deployed:

<!-- ignore -->

```bash
SimpleMinterUSC deployed to: 0x7d8726B05e4A48850E819639549B50beCB893506
```

Save the address of the contract. You will be needing it in [step 5]. Remember to exit the
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

## 5. Submit a mint query to the USC contract

Now that we've burnt funds on Sepolia, we can use that transaction to request a mint in our custom USC contract, 
this also includes generating the proof for the Oracle using the Creditcoin proof generator library.

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

## 6. Check Balance in USC Testnet ERC20 Contract

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
queries automatically. This _vastly_ improves UX by making it so the
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
[step 3.2]: #32-deploy-your-modified-contract
[step 5]: #5-submit-a-mint-query-to-the-usc-contract
[bridge offchain worker]: ../bridge-offchain-worker/README.md
