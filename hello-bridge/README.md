# Hello Bridge

This tutorial introduces you to one of the most common uses for a cross chain oracle, **cross chain 
bridging!** Cross-chain bridging on Creditcoin can be broken down into three broad steps:

1. To being, the `ERC20` tokens to bridge are burned using a smart contract on our _source chain_ 
   (in this case, Sepolia).
2. Then, we query the Creditcoin decentralized oracle for a _proof_ of our source chain token burn.
3. Finally, using the resulting proof from step 2, we mint the same amount of tokens on Creditcoin 
   (in this case, Creditcoin testnet).


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

We will be using Sepolia as our _source chain_ in this tutorial. To make transactions on Sepolia, we 
will first need a wallet with some funds.

### 1.1 Set up a wallet address for testing

> [!CAUTION]
> Only ever use this wallet for testing and never store significant amount of real-world assets on.
> it!

Create a new EVM wallet address for testing. In this tutorial, we will be using [🦊 Metamask]. 
Download the [chrome] or [firefox] extension and follow the on-screen steps to create a new wallet.

Once you have your new wallet up and running, start by making sure it is configured to use Sepolia.
You can do this by navigating to `settings -> advanced` and toggling `show test networks`. 
Alternatively, you can do this manually by opening the network selection menu, navigating to 
`Custom` and entering:

```yaml
Chain ID: 11155111
RPC: https://rpc.sepolia.org
Currency: ETH
```

### 1.2 Get some test funds (`Sepolia`)

Now that you have your new test address ready, you will be needing some funds to make transactions.
You can request some Sepolia test token using a [🚰 testnet faucet].

> [!Important]
> Most tesnet faucets will require you to deposit some small amount of mainnet `ETH` on your wallet 
> for it to be able to receive testnet funds (something like `0.001 ETH`). This serves as a way to
> prevent spam. Do this before requesting test funds.

### 1.3 Get some test funds (`Creditcoin`)

You will also need to fund your account on the Creditcoin Testnet, otherwise our oracle query 
submission will fail due to lack of funds. Head to the [🚰 creditcoin discord faucet] to request 
some test tokens there. Now that your wallet is ready to make transactions on both networks, you 
will be needing a way to interact with it from the command line.

### 1.4 Retrieving your private key

> [!CAUTION]
> In this tutorial, we will be using you wallet's private key to allow some test scripts to act on 
> your wallet's behalf. _This is only for testing purposes_ and should never be used in any other 
> scenario. **Never share your private key, it can be used to steal your funds!**

Here's how you can find your private key in MetaMask: head to `Account Settings -> Private Key`, 
then follow the on-screen instructions to copy it. You will need to do this several times in the 
following sections.

### 1.5. Obtaining an RPC key

Finally, you will need a way to send requests to the Sepolia test chain. The easiest way to do this
is to sign up with an _RPC provider_. [Infura] will work for testing purposes.

Follow the onscreen instructions to create your account and generate your first api key. Make sure
you are requesting an Ethereum API key. Copy it: you will be needing it in the following steps. You
are now ready to go with the rest of the tutorial!

## 2. Minting some tokens on Sepolia

More tokens? But I thought I had all the tokens I needed! Well, kind of. Test tokens for Sepolia and
Creditcoin are kind of hard to come by, and you are generally limited in the amount you can request
per day, so we don't want to be burning those. Instead, we will be minting our own (worthless) 
tokens on Sepolia to then bridge them to Creditcoin.

For your convenience, we have [already deployed] a test `ERC20` contract to Sepolia which you can 
use to mint some dummy tokens. Run the following command:

```bash
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API key> \
    0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8                         \
    "mint(uint256)" 50000                                              \
    --private-key <Your private key>
```

## 3. Burning the tokens you want to bridge

The first step in bridging tokens is to burn them on the _source chain_ (Sepolia in this case). We 
burn tokens by transferring them to an address for which the private key is unknown, making them 
inaccessible. This way, when creating the same amount of tokens on Creditcoin at the end of the
bridging process, we won't be creating any artificial value. Run the following command:

```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API key> \
    0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8                         \
    "burn(uint256)" "50"                                               \
    --private-key <Your private key>
```

This should display some output stating that your transaction was a success, along with a 
transaction hash:

```bash
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
```

Save the transaction hash. You will be needing it in the next step.

## 4. Get a proof of the token burn from the Creditcoin Oracle

Great, we've burned some tokens! But how can we prove it? Most cross-chain bridges rely on a
_centralized_, _trusted_ approach: one service or company handles all the token burns on the _source
chain_ and is responsible for distributing the same amount of tokens on the target chain. This can
be an issue, since nothing is preventing that company from censoring certain transactions or even
stealing funds! Web3 was made to be _trustless_ and _decentralized_, let's make it that way 😎.

Now that we've burnt funds on Sepolia, we need to create a proof of that token burn using the
Creditcoin Decentralized Oracle. We do this by submitting an _oracle query_. Run the following 
command:

```sh
yarn submit_query                                      \
    https://sepolia.infura.io/v3/<Your infura API key> \
    <Transaction hash from step 3>                     \
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

## 5. Mint Tokens on Creditcoin

Now that we have a proof of the token burn on our _source chain_, we can finalize the bridging 
process by minting the same amount of tokens on the Creditcoin testnet. To do that, we need to call 
a [bridge contract] on Creditcoin which will _trustlessly_ very the proof from step 4. We have 
already deployed this contract for you, but in a real scenario you would want to use your own custom 
contracts if you were implementing a bridge from scratch. 

Run the following command to query the bridge contract:

```sh
yarn complete_mint                             \
    <Your private key>                         \
    0x441726D6821B2009147F0FA96E1Ee09D412cCb38 \
    0xc43402c66e88f38a5aa6e35113b310e1c19571d4 \
    <Query Id from step 4>                     \
    0xb0fb0b182f774266b1c7183535A41D69255937a3
```

Congratulations, you've just made your first _trutsless bridge transaction_ using the Creditcoin
Decentralized Oracle!

## 8. Check Balance in USC Testnet ERC20 Contract

As a final check, we can take a look at the balance of your account on Creditcoin to confirm that 
the bridging process was successful. This will use an [ERC20 contract] which mirrors the test token 
contract we deployed on Sepolia. This has already deployed for you on Creditcoin, in fact you have 
already been using it in the previous steps to mint tokens there! In a real scenario, you would 
probably want to have a separate `ERC20` contract for each of the assets you allow to be bridged to 
Creditcoin this way.

Run the following command to query the contract:

```sh
yarn check_balance                             \
    0xb0fb0b182f774266b1c7183535A41D69255937a3 \
    <You Sepolia wallet address>
```

You should get some output showing your wallet's balance on Creditcoin:

```bash
📦 Token: Mintable (TEST)
🧾 Raw Balance: 50
💰 Formatted Balance: 0.00000000000000005 TEST
```

# Conclusion

Congratulations, you've bridged your first funds using the **Creditcoin Decentralized oracle!** This
is only a simple example of the cross chain functionality made possible by Creditcoin, keep on 
reading to find more ways in which you can leverage decentralized cross-chain proofs of state!

In the next tutorial we will be looking at the next piece in the puzzle of decentralized bridging: 
self-hosted smart contracts! In a production environment, the Creditcoin oracle will almost always 
be used by teams of DApp builders who will handle data provisioning on behalf of their end users. 
Such teams will want to define and deploy their own contracts as shown in the [custom contract 
bridging] tutorial.

[enable flakes]: https://nixos.wiki/wiki/flakes#Enable_flakes_temporarily
[yarn]: https://yarnpkg.com/getting-started/install
[foundry]: https://getfoundry.sh/
[🦊 MetaMask]: https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?utm_source=www.google.com
[chrome]: https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?utm_source=www.google.com
[firefox]: https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/
[🚰 testnet faucet]: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
[🚰 creditcoin discord faucet]: https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1
[Infura]: https://developer.metamask.io/register
[already deployed]: https://sepolia.etherscan.io/address/0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8
[bridge contract]: https://explorer.ccnext-testnet.creditcoin.network/address/0x441726D6821B2009147F0FA96E1Ee09D412cCb38
[ERC20 contract]: https://explorer.ccnext-testnet.creditcoin.network/token/0xb0fb0b182f774266b1c7183535A41D69255937a3
[custom contract bridging]: ../custom-contracts-bridging/README.md
