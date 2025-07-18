# Hello Bridge
Hello bridge simulates one of the most common uses for a cross chain bridge, cross chain token transfers! Each transfer has a few parts:
1. Burn ERC20 tokens in a smart contract on Sepolia
2. Trigger the CCNext token bridging process
3. Use the bridging outputs to mint tokens in the CCNext EVM

# Tutorial Steps

## 1. Build Scripts
```sh
cd hello-bridge
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

Then enter your wallet address here and request Sepolia ETH 

https://cloud.google.com/application/web3/faucet/ethereum/sepolia 

### 1.3 Obtain Private Key
For a later tutorial step, you will need to provide the private key of the account holding your Sepolia ETH to Anvil. 

Your private key can be found at:
MetaMask -> drop down menu -> Account Details -> Details -> Show Private Key

Save this key for later use.

## Call Mint on Sepolia Contract
We need to mint ourself tokens on the previously deployed `TestERC20` contract so that we can burn them later. 

```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API Key> <CONTRACT-ADDRESS> "transfer(address, uint256)" "0x0000000000000000000000000000000000000001" "50" --private-key 0x<key you funded with Sepolia ETH>
```

```sh
cast send --rpc-url https://sepolia.infura.io/v3/c5bff627d3274bb3bcaf7733cc427320 \
0xAA7b2723d7E104726A2258c4f9Ad8680aaC9d1B1 \
"mint(uint256)" 50000 \
--private-key 0xa9b3538dc2b9fc0b520616adeb9e4baf96223e67e9dd80f41afc4a468833a180
```