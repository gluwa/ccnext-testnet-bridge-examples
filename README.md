# ccnext-testnet-bridge-example
This repository facilitates three examples that make use of the CCNext decentralized bridge. 

Tutorial 1, `hello-bridge`, is an example which demonstrates bridge usage from the perspective of an end user. Hello bridge makes use of pre-existing smart contracts on Sepolia and on the CCNext Testnet so that the user only needs to worry about triggering steps of the bridging process.

Tutorial 2, `custom-contracts-bridging`. This is a more involved process which simulates the most basic builder experience. First we launch the contracts for our own dApp, then we trigger bridging that makes use of our new contracts.

Tutorial 3, `bridge-offchain-worker`. This tutorial adds a new piece of server infrastructure which improves security in the bridging process and reduces hassle to end users. Namely, the `Bridge Offchain Worker`. This worker automates two key bridging steps we've been triggering manually thus far. In practice, DApp builders will want to conduct all bridging via an offchain worker in order to ensure security and reduce hassle for end users.

# Usage
It is highly recommended that you complete these tutorials in order:
1. `hello-bridge`
2. `custom-contracts-bridging`
3. `bridge-offchain-worker`

To start, just navigate to each tutorial's corresponding readme. (EX: `hello-bridge/README.md`)