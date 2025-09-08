# ccnext-testnet-bridge-example

This repository helps potential users and builders to explore the new Creditcoin cross-chain feature set code named `CCNext`. It facilitates three examples that make use of the `Creditcoin Decentralized Oracle` and `Universal Smart Contracts`. All of these tutorials make use of one of the simplest uses for an oracle, token bridging!

As companion content for these tutorials consider reading the `User Infrastructure` section here:
https://app.gitbook.com/o/-LjFKFsSaSJudznvwK-5/s/Vp3bVdljVxZuwysnIzZ1/oracle-user-infrastructure/user-infrastructure-overview
It will give you an overview of the various components that a team using the Creditcoin Oracle will need to set up

Tutorial 1, `hello-bridge`, is an example which demonstrates oracle usage from the perspective of an end user. Hello bridge makes use of pre-existing smart contracts on Sepolia and on the Creditcoin USC Testnet so that the user only needs to worry about triggering steps of the oracle data provisioning process.

Tutorial 2, `custom-contracts-bridging`. This is a more involved process which simulates the most basic builder experience. First we launch the contracts for our own dApp, then we trigger bridging that makes use of our new contracts.

Tutorial 3, `bridge-offchain-worker`. This tutorial adds a new piece of server infrastructure which improves security in the oracle data provisioning process and reduces hassle to end users. Namely, the `Bridge Offchain Worker`. This worker automates two key oracle use steps we've been triggering manually thus far. In practice, DApp builders will want to conduct all oracle use via an offchain worker in order to ensure security and reduce hassle for end users.

# Usage

It is highly recommended that you complete these tutorials in order:

1. `hello-bridge`
2. `custom-contracts-bridging`
3. `bridge-offchain-worker`

To start, just navigate to each tutorial's corresponding readme. (EX: `hello-bridge/README.md`)
