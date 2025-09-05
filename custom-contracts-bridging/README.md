# Custom Contract Bridging

> [!TIP]
> This tutorial builds on the previous [Hello Bridge] example -make sure to check it out before 
> moving on!

Now that you have performed your first _trustless bridge transaction_, its time to get your hands
dirty: this tutorial teaches you how to set up your own custom bridging logic by deploying your own
smart contracts!

## External dependencies

To continue with this tutorial, you will first need to have the following dependencies available
locally:

- [yarn]
- [foundry]

> [!TIP]
> This project provides a `flake.nix` you can use to download all the dependencies you will need for 
> this tutorial inside of a sandboxed environment. Just keep in mind you will have to **[enable 
> flakes]** for this to work. To start you development environment, simply run:
>
> ```bash
> nix develop
> ```

Once you have all your dependencies setup, you will need to download some packages with `yarn`:

```sh
cd hello-bridge
foundryup --version v1.2.3 # Skip this command if you are using nix!
yarn
```

## 1. Setup

This is the same as in [Hello Bridge]. If you have not already done so, follow the installation 
steps in the [setup] section there.

## 2. Deploy A Test `ERC20` Contract on Sepolia

Let's start by deploying our own `ERC20` contract on Sepolia. The contract contains logic for 
tracking the balance of a coin called `TEST`. The contract also automatically funds its creator's
address with 1000 `TEST` coins, so we won't have to mint `TEST` tokens manually. 

Run the following command to deploy the contract:

```sh
forge create                                                     \
    --broadcast                                                  \
    --rpc-url https://sepolia.infura.io/v3/<Your Infura API key> \
    --private-key <Your private key>                           \
    TestERC20
```

This should display some output containing the address of your test `ERC20` contract:

```bash
Deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

Save the contract address. You will be needing it in the next step.

## 3. Deploy Your Own Custom Bridging Contracts

In the next few steps we will be deploying our own bridging contracts based off the 
`CCNext-smart-contracts` repository. This repository contains templates for the two smart contracts 
we will be using:

- `UniversalBridgeProxy.sol`
- `ERC20Mintable.sol`

Proxy contracts such as `UniversalBridgeProxy` are intended to be deployed by DApp builders. Here, 
our proxy contract is used only for bridging tokens. A proxy contract interprets the oracle proof 
data which is send to it, and serves out relevant output for a DApp to process.

For instance, our `UniversalBridgeProxy` looks for fields like `from`, `to`, and `amount` in the 
oracle proof we submit to it. With those fields, the contract can verify whether or not a token 
burn took place, how many tokens it needs to mint on Creditcoin, and which address it should mint 
them to.

Our other contract, `ERC20Mintable`, is only used to mint our newly bridged tokens. It is modified
so that its `_mint()` function can be called by the our `UniversalBridgeProxy` contract.

Start by cloning the `CCNext-smart-contracts` repository:

```sh
git clone git@github.com:gluwa/CCNext-smart-contracts.git
cd CCNext-smart-contracts
git checkout beb448380c509c7833a23095e5efb91bb97f6d5e
```

### 3.1 Modify The Bridge Smart Contract

As an exercise, we will be modifying our `UniversalBridgeProxy` so that it mints _twice_ the amount
of tokens which were burned on our _source chain_. 

> [!NOTE]
> This is a terrible idea in practice, as we are just diluting the value of our `TEST` token each
> time we bridge it.

In your freshly cloned `CCNext-smart-contracts` repository, start by opening the file 
`contracts/UniversalBridgeProxy.sol`. Next, navigate to line `230` inside of the 
`uscBridgeCompleteMint` function. Update it so that your `UniversalBridgeProxy` contract mints twice
the `amount` of tokens it should on Creditcoin. The resulting line should look something like:

```sol
_mintTokens(ERC20Address, fromAddress, amount * 2, queryId);
```

### 3.2 Deploy Your Modified Contracts

To deploy your modified bridging contracts, start by creating a `.env` file at the top-level of the 
`CCNext-smart-contracts` repository and add the following contents inside of it:

```env
OWNER_PRIVATE_KEY=<Your private key>
```

Next, compile your bridging smart contracts:

```bash
npm install && npx hardhat compile
```

Finally, deploy your contracts using the following command:

```bash
npx hardhat deploy                      \
    --network ccnext_testnet            \
    --proceedsaccount <Your public key> \
    --erc20name Test                    \
    --erc20symbol TEST                  \
    --chainkey 102033                   \
    --timeout 300                       \
    --lockupduration 86400              \
    --approvalthreshold 2               \
    --maxinstantmint 100                \
    --admin <Your public key>
```

> [!TIP]
> This can take a bit of time ☕

You should get some output with the address of the contracts you just deployed:

```bash
ERC20Mintable deployed to: 0x7d8726B05e4A48850E819639549B50beCB893506
UniversalBridgeProxy deployed to: 0x4858Db7F085418301A010c880B98374d83533fa2
```

Save the address of each contract. You will be needing them in step 6. Remember to exit the 
`CCNext-smart-contracts` repository:

```bash
cd ..
```

## 4. Burning the tokens you want to bridge

The following few steps are similar to what we did in the [Hello Bridge] example. Start by burning
the tokens you want to bridge on the _source chain_ (Sepolia in this case). We will be burning the
`TEST` tokens from the test `ERC20` contract which we deployed in step 2. We do this by transferring
them to an address for which the private key is unknown, making them inaccessible.

Run the following command to initiate the burn:

```bash
cast send                                                        \
    --rpc-url https://sepolia.infura.io/v3/<Your Infura API key> \
    <Test ERC20 contract address from step 2>                    \
    "burn(uint256)" "50"                                         \
    --private-key <Your private key>
```

This should display some output stating that your transaction was a success, along with a 
transaction hash:

```bash
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
```

Save the transaction hash. You will be needing it in the next step.

## 5. Get a proof of the token burn from the Creditcoin Oracle

Now that we've burnt funds on Sepolia, we need to create a proof of that token burn using the
Creditcoin Decentralized Oracle. We do this by submitting an _oracle query_. Run the following 
command:

```sh
yarn submit_query                                      \
    https://sepolia.infura.io/v3/<Your infura API key> \
    <Transaction hash from step 4>                     \
    0x<Your private key>
```

> [!TIP]
> This will take a while. Sit back, relax, and wait for the query to process ☕ Proving should take 
> ~16 minutes and no more than 30 minutes.

Once the proving process completes, you should see some output stating that your query was proven
successfully, along with a query id:

```bash
Query Proving completed. QueryId: 0x7ee33a2be05c9019dedcd833c9c2fa516c2bd316b225dd7ca3bde5b1cdb987db
```

Save the query id. You will be needing it in the next step.

## 6. Mint Tokens on Creditcoin

Now that we have a proof of the token burn on our _source chain_, we can finalize the bridging 
process by minting the same amount of tokens on the Creditcoin testnet. To do that, we need to call 
your `UniversalBridgeProxy` contract on Creditcoin. This will _trustlessly_ very the proof from step
5.

Run the following command to query the proxy contract:

```sh
yarn complete_mint                               \
    <Your private key>                           \
    <UniversalBridgeProxy address from step 3.2> \
    0xc43402c66e88f38a5aa6e35113b310e1c19571d4   \
    <Query Id from step 5>                       \
    <ERC20Mintable address from step 3.2>
```

Congratulations, you've just set up and used your very own _trustless bridge_!

## 7. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that 
the bridging process was successful. This will use the `ERC20Mintable` contract which you deployed
in step 3.2 

Run the following command to query the contract:

```sh
yarn check_balance                        \
    <ERC20Mintable address from step 3.2> \
    <You Sepolia wallet address>
```

You should get some output showing your wallet's balance on Creditcoin:

```bash
📦 Token: Mintable (TEST)
🧾 Raw Balance: 100
💰 Formatted Balance: 0.00000000000000005 TEST
```

Notice how you now have _twice_ the amount of tokens you originally minted on Sepolia!

# Conclusion

Congratulations! You've set up your first custom smart contracts which make use of the Creditcoin
Decentralized Oracle!

The next tutorial will bring this one step further by automating a lot of the work we have had to do
manually so far. We will do this by using an **offchain worker** which will handle the proof query 
submission as well as sending the result of that query to our bridging proxy contract on Creditcoin.
This _vastly_ improves UX by making it so the end user only has to sign a _single_ transaction to 
initiate the bridging procedure.

In practice, DApp builders will want to conduct all cross-chain queries via an offchain worker in 
order to ensure robustness and streamline UX. Checkout the [bridge offchain worker] tutorial next 
for more information on this!

[Hello Bridge]: ../hello-bridge/README.md
[setup]: ../hello-bridge/README.md#setup
[bridge offchain worker]: ../bridge-offchain-worker/README.md
