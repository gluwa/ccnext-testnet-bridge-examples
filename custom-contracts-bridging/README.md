## 0. Setup
Install Foundry: See https://book.getfoundry.sh/getting-started/installation 

Get dependencies and build
```sh
cd custom-contracts-bridging
yarn
forge build
```

## 1. Create Funded Sepolia Account
Skip this step if you already completed the `hello-bridge` tutorial.

Otherwise, you can find directions in steps 1.1, 1.2, and 1.3 [here](../hello-bridge/README.md)

## 2. Create Funded CCNext Testnet Account
Skip this step if you already completed the `hello-bridge` tutorial.

Otherwise, see step 2 [here](../hello-bridge/README.md)

## 3. Obtain Infura API Key
Skip this step if you already completed the `hello-bridge` tutorial.

Otherwise, see step 3 [here](../hello-bridge/README.md)

## 4. Deploy TestERC20 Smart Contract on Sepolia
We want to deploy a TestERC20 smart contract on Sepolia. The contract contains logic for tracking balances of a coin called TEST. The contract also automatically funds its creator's address with 1000 TEST coins. It is these coins which we will burn and then mint on CCNext Testnet.

Run the following to deploy your contract:

```sh
cd custom-contracts-bridging
forge create --rpc-url https://sepolia.infura.io/v3/<Your infura API Key> --private-key 0x<key you funded with Sepolia ETH> TestERC20
```

```sh
cd custom-contracts-bridging
forge create \
  --rpc-url https://sepolia.infura.io/v3/c5bff627d3274bb3bcaf7733cc427320 \
  --private-key 0xa9b3538dc2b9fc0b520616adeb9e4baf96223e67e9dd80f41afc4a468833a180 \
  TestERC20
```

Upon successful contract creation, the resulting logs will contain your TestERC20 contract address. We will need this in the next step.
EX: "Deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"

## 5. Clone the CCNext-smart-contracts Repository
This repository contains templates for two smart contracts we need to launch for this example.

1. UniversalBridgeProxy.sol
2. ERC20Mintable.sol

Bridge proxy contract instances are intended to be deployed by teams of DApp builders. Each bridge proxy contract interprets bridging outputs relevant to the DApp it serves. 

For instance, a bridge proxy contract enabling token minting would look for fields like `from`, `to`, and `amount` in bridging outputs. With those fields the contract can determine whether a token burn took place, how many tokens to mint, and which address to mint them in.

The ERC20Mintable contract is just a place to mint our newly bridged tokens in. The ERC20Mintable contract is modified so that its _mint() function can be called by the UniversalBridgeProxy contract.

```sh
cd custom-contracts-bridging
git clone git@github.com:gluwa/CCNext-smart-contracts.git
```

## 6. Modify Your Own Bridge Smart Contract Instance
Imagine for example that we want to mint 2 MNT tokens on CCNext Testnet for every TEST token burned on Sepolia. Then we need to modify our bridge proxy contract to multiply the burned amount by 2 before minting.

In your freshly cloned `CCNext-smart-contracts` repository, open the file `eth/contracts/UniversalBridgeProxy.sol`

Within the function `uscBridgeCompleteMint` find the line where we call `_mintTokens`. Then modify `amount` to `amount * 2`.

The resulting line should look like:
```sol
_mintTokens(ERC20Address, fromAddress, amount * 2, queryId);
```

## 7. Deploy Your Bridge and ERC20Mintable Contracts
See the section `Deploying UniversalBridgeProxy and ERC20Mintable Contracts on CCNext` [here](https://github.com/gluwa/CCNext-smart-contracts/blob/main/README.md)

When you deploy your contracts retain the contract addresses from this log output:
```sh
UniversalBridgeProxy deployed to: 0x4858Db7F085418301A010c880B98374d83533fa2
ERC20Mintable deployed to: 0x7d8726B05e4A48850E819639549B50beCB893506
```

## 8. Burn Funds on Sepolia Contract
The first step of bridging tokens is to burn those tokens on the sending chain (Sepolia). For this example we burn TEST tokens in the `TestERC20` contract we created in step 4.

We burn funds by transferring them to an address for which the private key is unknown. Thereby the funds become inaccessable.

EX:
```sh
cast send --rpc-url https://sepolia.infura.io/v3/<Your Infura API Key> <Contract address from step 4> "transfer(address, uint256)" "0x0000000000000000000000000000000000000001" "50" --private-key <key you funded with Sepolia ETH>
```

Save the transaction hash of your token burn transaction for later use

EX:
transactionHash         0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1

## 9. Submit Bridging Query to CCNext Prover
Now that we've burnt funds on Sepolia, we need to make proof of that token burn available on the CCNext Testnet. We do so by creating a "bridging query".

```sh
yarn submit_query
```

When prompted, provide the following:
- Your Infura url: https://sepolia.infura.io/v3/<Your Infura API Key>
- Your transaction hash from step 8
TODO: Replace this well known testing key with instructions to use testnet faucet and fund an address
- The private key of the CCNext address we funded in step 2

Proving should take ~8 minutes and no more than 30 minutes.

Once the proving process completes, save the QueryId printed for later:

EX:
Query Proving completed. QueryId: 0x7ee33a2be05c9019dedcd833c9c2fa516c2bd316b225dd7ca3bde5b1cdb987db

## 10. Use Bridged Data to Mint Tokens on CCNext Testnet
We need to call `uscBridgeCompleteMint` in the bridge contract we deployed to CCNext Testnet in step 7.

We also supply the address of the mintable contract we deployed in step 7. This is the contract in which our bridged tokens will be minted.

Finally, we provide the QueryId we saved in step 9.

TODO: Replace shared testing private key with instructions to use CCNext faucet once set up
TODO: Add in contract address for prover contract on testnet once it exists
```sh
yarn complete_mint.js \
0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b \
<bridge_contract_address> \
<prover_contract_address> \
<query_id> \
<mintable_contract_address>
```

## 11. Check Balance in CCNext Test ERC20 Contract
As a final check, we take a look at the balance in our account within the ERC20Mintable contract where we minted our tokens.

```sh
yarn check_balance <mintable_contract_address> <Your account address from Sepolia>
```

You should see a result like:
📦 Token: Mintable (MNT)
🧾 Raw Balance: 100
💰 Formatted Balance: 0.0000000000000001 MNT

# Conclusion
Congratulations! You've launched your first custom smart contracts making use of the CCNext Decentralized bridge!

The next tutorial will add a `Bridge Offchain Worker` which automates two key bridging steps we've been triggering manually thus far. In practice, DApp builders will want to conduct all bridging via an offchain worker in order to ensure security and reduce hassle for end users. Take a look at the `bridge-offchain-worker` tutorial to learn more.










## 0. Deploy ERC 20 Contract in Which Tokens Will Be Minted
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