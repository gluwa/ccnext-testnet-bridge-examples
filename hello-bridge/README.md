# Hello Bridge
Hello bridge simulates one of the most common uses for a cross chain oracle, cross chain bridging! Each transfer has a few parts:
1. Burn ERC20 tokens in a smart contract on Sepolia
2. Trigger the Creditcoin oracle to supply proof of our Sepolia token burn
3. Use the oracle outputs to mint tokens in the Creditcoin USC Testnet EVM

# Tutorial Steps

## 0. Get Script Dependencies
```sh
cd hello-bridge
foundryup --version v1.2.3
yarn
```

## 1. Fund an Address on Sepolia
To make transactions on Sepolia, we first need a wallet with funds. To obtain one, follow the steps below.

### 1.1 Install a Wallet Extension
Most users use MetaMask. https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?utm_source=www.google.com 

Ensure it's configured for Sepolia:
  Click the network dropdown in MetaMask
  Choose Sepolia (or manually add it with):
    Chain ID: 11155111
    RPC: https://rpc.sepolia.org
    Currency: ETH

### 1.2 Use Sepolia Faucet
Create a new wallet on MetaMask for this proof of concept. 

!!DON'T USE A WALLET WHICH HOLDS ANY REAL ASSETS, EVEN ON A DIFFERENT NETWORK!!

Then enter your wallet address here and request Sepolia ETH 

https://cloud.google.com/application/web3/faucet/ethereum/sepolia 

### 1.3 Obtain Private Key
For a later tutorial step, you will need to provide the private key of the account holding your Sepolia ETH to Anvil. 

Your private key can be found at:
MetaMask -> drop down menu -> Account Details -> Details -> Show Private Key

Save this key for later use.

## 2. Fund a Creditcoin USC Testnet Address from Faucet
TODO: Add faucet step here once faucet exists. Then replace any mention of testing key 0x45fbbc5105365822a75e09844a560445cbccf172da3087a94b5812e1871ef591

## 3. Obtain Infura API Key
The easiest way to submit transactions to Sepolia is to use Infura with your own api key.

You can get an api key by making an account with Infura (Metamask Developer) [here](https://developer.metamask.io/register)

Then you can access your api key from the dashboard [here](https://developer.metamask.io/)

## 4. Call Mint on Sepolia ERC20 Contract
We need to mint ourself tokens on the previously deployed `TestERC20` contract (0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8) so that we can burn them later. 

```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API Key> 0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8 "mint(uint256)" 50000 --private-key <private key you funded with Sepolia ETH>
```

## 5. Burn Funds on Sepolia Contract
The first step of bridging tokens is to burn those tokens on the sending chain (Sepolia). 

We burn funds by transferring them to an address for which the private key is unknown. Thereby the funds become inaccessable.

EX:
```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API Key> 0x15166Ba9d24aBfa477C0c88dD1E6321297214eC8 "burn(uint256)" "50" --private-key <key you funded with Sepolia ETH>
```

Save the transaction hash of your token burn transaction for later use

EX:
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1

## 6. Submit Oracle Query to Creditcoin Oracle
Now that we've burnt funds on Sepolia, we need to make proof of that token burn available on the Creditcoin USC Testnet. We do so by creating a "oracle query".

```sh
yarn submit_query \
https://sepolia.infura.io/v3/<your_infura_api_key> \
<transaction_hash_from_step_5> \
<private_key_of_address_from_step_2>
```

Proving should take ~16 minutes and no more than 30 minutes.

Once the proving process completes, save the QueryId printed for later:

EX:
Query Proving completed. QueryId: 0x7ee33a2be05c9019dedcd833c9c2fa516c2bd316b225dd7ca3bde5b1cdb987db

## 7. Use Oracle Provisioned Data to Mint Tokens on Creditcoin USC Testnet
We need to call `uscBridgeCompleteMint` in the pre-existing bridge contract at address 0x441726D6821B2009147F0FA96E1Ee09D412cCb38 on Creditcoin USC Testnet. 

Use the following command to complete your token mint. Several contract addresses are already filled in for you, but you'll have to provide your Creditcoin USC Testnet private key and the oracle query id from step 6.
```sh
yarn complete_mint \
<private_key_of_address_from_step_2> \
0x441726D6821B2009147F0FA96E1Ee09D412cCb38 \
0x5768012415bac3592c8a12fc38e84cb85d159246 \
<query_id> \
0xb0fb0b182f774266b1c7183535A41D69255937a3
```

## 8. Check Balance in USC Testnet ERC20 Contract
As a final check, we take a look at the balance in our account within the ERC20 contract where we minted our tokens.

The ERC20 contract for this tutorial lives at address 0xb0fb0b182f774266b1c7183535A41D69255937a3 on USC Testnet

```sh
yarn check_balance \
0xb0fb0b182f774266b1c7183535A41D69255937a3 \
<your_account_address_from_sepolia>
```

You should see a result like:
📦 Token: Mintable (MNT)
🧾 Raw Balance: 50
💰 Formatted Balance: 0.00000000000000005 MNT

# Conclusion
Congratulations! You've bridged your first funds using the Creditcoin Decentralized oracle. This is only one simple example of the cross chain functionality made possible by the novel Creditcoin oracle. 

The next tutorial will add an additional piece of the puzzle, self hosted smart contracts! In production, the Creditcoin oracle will almost always be used by teams of DApp builders who will conduct data provisioning on behalf of their end users. Such teams will want to define and deploy their own contracts as shown next in the `custom-contracts-bridging` tutorial.