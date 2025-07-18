# Devnet Universal Smart Contract Proof of Concept (USC POC)

**This example uses the decentralized bridging capabilities of Creditcoin Next to allow for crosschain interactions in a Universal Smart Contract. The Universal Smart Contract (USC) in this example allows for simple burn + mint functionality, where an ERC 20 token is burned on a source chain such as Ethereum and then minted as a corresponding ERC 20 in the CC3 EVM.**

# Running the POC on Devnet

## 0. Setup
Install Foundry: See https://book.getfoundry.sh/getting-started/installation 

Get dependencies and build
```sh
cd bridge-usage-example
npm install
forge build
```

## 1. Fund an Address on Sepolia
We want to deploy a simple source chain smart contract that will allow us to make an ERC20 token burn. This is the transaction that we will eventually be bridging to CCNext. To deploy a smart contract we first need a funded Sepolia address.

### 1.1 Install a Wallet Extension
Most users use MetaMask. https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?utm_source=www.google.com 

Ensure it's configured for Sepolia:
  Click the network dropdown in MetaMask
  Choose Sepolia (or manually add it with):
    Chain ID: 11155111
    RPC: https://rpc.sepolia.org
    Currency: ETH

### 1.2 Use Sepolia Faucet
Create a burner wallet on MetaMask for this proof of concept.

Then enter your wallet address here and request Sepolia ETH 

https://cloud.google.com/application/web3/faucet/ethereum/sepolia 

### 1.3 Obtain Private Key
For a later tutorial step, you will need to provide the private key of the account holding your Sepolia ETH to Anvil. 

Your private key can be found at:
MetaMask -> drop down menu -> Account Details -> Details -> Show Private Key

Save this key for later use.

## 2. Deploy TestERC20 Smart Contract on Source Chain
A source chain is any chain which CCNext provides a bridge to. In our example the source chain is Sepolia.

We want to deploy our TestERC20 smart contract on our source chain. The contract automatically funds its creator's address with 1000 TEST coins.

We need to create an MetaMask Developer account in order to obtain an API key for submitting our rpc call. 

Create an account on https://developer.metamask.io/ and generate your personal API key for free.

Run the following to deploy your contract:

```sh
cd bridge-usage-example
forge create --rpc-url https://sepolia.infura.io/v3/<Your infura API Key> --private-key 0x<key you funded with Sepolia ETH> TestERC20
```

```sh
cd bridge-usage-example
forge create \
  --rpc-url https://sepolia.infura.io/v3/c5bff627d3274bb3bcaf7733cc427320 \
  --private-key 0xa9b3538dc2b9fc0b520616adeb9e4baf96223e67e9dd80f41afc4a468833a180 \
  TestERC20
```

Upon successful contract creation, the resulting logs will contain your TestERC20 contract address. We will need this in the next step.
EX: "Deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"

## 3. Burn TestERC20 Tokens
Burn contract tokens by transferring them to one of the 0x0000000... addresses. Use the your private key and contract address from step 2.

cast send --rpc-url <RPC-URL> <CONTRACT-ADDRESS> "transfer(address, uint256)" <ADDRESS> <AMOUNT> --private-key <PRIVATE-KEY>

Again, we use our pre-funded Anvil account with private key 0xac09...
EX:
```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API Key> <CONTRACT-ADDRESS> "transfer(address, uint256)" "0x0000000000000000000000000000000000000001" "50" --private-key 0x<key you funded with Sepolia ETH>
```

```sh
cast send --rpc-url https://sepolia.infura.io/v3/c5bff627d3274bb3bcaf7733cc427320 0x8Af09FAc4BE22C4Cb72645F76211512376373Eea "transfer(address, uint256)" "0x0000000000000000000000000000000000000001" "50" --private-key 0xa9b3538dc2b9fc0b520616adeb9e4baf96223e67e9dd80f41afc4a468833a180
```

## 4. Create a CCNext Proving Query
To create a query bridging our token burn transaction to CCNext, we run the query-cli.

The argument `--prover-contract-address` is subject to change, as it will be different every time devnet is reset. Contact the CCNext core dev team for an up to date prover address. 

```sh
cd query-cli
cargo run -- \
  --cc3-rpc-url https://rpc.ccnext-devnet.creditcoin.network \
  --cc3-evm-private-key "8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b" \
  --prover-contract-address 0xc1af0939ad5c9c193de0d64873736f09a53b4a92 \
  --eth-rpc-url https://sepolia.infura.io/v3/<Your Infura API Key>
```

```sh
cargo run -- \
  --cc3-rpc-url https://rpc.ccnext-devnet.creditcoin.network \
  --cc3-evm-private-key "8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b" \
  --prover-contract-address 0xc1af0939ad5c9c193de0d64873736f09a53b4a92 
```

Provide the following responses to the CLI prompts:
Network: 1 (Sepolia),
Infura API key: <Your Infura API Key>
Block Height: "Block height of your transaction from step 3",
Transaction Hash: "Hash of your transaction from step 3",
Data: ERC 20 Transfer Data

After your query is registered in the CCNext EVM, the prover will begin proving your transaction. This usually takes about 15 minutes. When proving is complete the proven results are posted on the CCNext Substrate chain, emitting a `QueryVerified` event.

Note:
Alternatively, you can stand up your own prover against devnet by following the directions in `prover/README.md`. You'd have to provide the following arguments:
```sh
--cc3_rpc_url https://rpc.ccnext-devnet.creditcoin.network
--eth_rpc_url TODO: Find eth rpc url that won't require api key or be flaky for sepolia
```

## 5. Deploy Your Own Bridge Smart Contract Instance
See https://github.com/gluwa/CCNext-smart-contracts/blob/main/eth/README.md 

When you deploy your contract retain the contract address from this log output:
```sh
UniversalBridgeProxy deployed to: 0x4858Db7F085418301A010c880B98374d83533fa2
```

## 6. Deploy ERC 20 Contract in Which Tokens Will Be Minted
TODO: Replace shared testing private key with instructions to use CCNext faucet once set up
```sh
cd bridge-usage-example
forge create \
  --rpc-url https://rpc.ccnext-devnet.creditcoin.network \
  --private-key 0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b \
  ERC20Mintable \
  --constructor-args "Mintable" "MNT"
```

When you deploy your contract retain the contract address from this log output:
```sh
UniversalBridgeProxy deployed to: 0x7d8726B05e4A48850E819639549B50beCB893506
```

## 7. Use Bridge Contract to Verify Token Burn and Mint Tokens
We need to call `uscBridgeCompleteMint` in our bridge smart contract instance from step 5. 

TODO: Replace shared testing private key with instructions to use CCNext faucet once set up
```sh
cd bridge-usage-example
node complete_mint.js 0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b <bridge-contract_address> <prover_address> <query_id> <mint_contract_address>
```

```sh
cd bridge-usage-example
node complete_mint.js 0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b 0x183EB7C3DeB727799ec09F464B682cC828c9fc57 0xc1af0939ad5c9c193de0d64873736f09a53b4a92 0x5a5116e6c1678155601d8e9df01b36fb205e3004e71dd76ef7f23f993ffd03c5 0xF87960561ac3331f3492523fEf5F6096A460A413
```
