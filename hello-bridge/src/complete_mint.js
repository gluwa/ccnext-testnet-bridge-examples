const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// === Parse command-line arguments ===
if (process.argv.length !== 7) {
    console.error(`
Usage:
  node complete_mint.js <private_key> <contract_address> <prover_address> <query_id> <erc20_address>

Example:
  node complete_mint.js 0xaabb...ccdd 0xd2cAb2Aa... 0x123...abc 0x456...def 0x789...ghi
    `);
    process.exit(1);
}

const PRIVATE_KEY = process.argv[2];
const CONTRACT_ADDRESS = process.argv[3];
const PROVER_ADDRESS = process.argv[4];
const QUERY_ID = process.argv[5];
const ERC20_ADDRESS = process.argv[6];

// === RPC and signer setup ===
const RPC_URL = "https://rpc.ccnext-testnet.creditcoin.network";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// === Load ABIs from JSON files ===
const USCBridgeABI = JSON.parse(fs.readFileSync(path.join(__dirname, "contract-abis/USCBridge.json"), "utf8"));
const ProverABI = JSON.parse(fs.readFileSync(path.join(__dirname, "contract-abis/prover.json"), "utf8"));

async function main() {
    console.log(`📨 Calling uscBridgeCompleteMint...`);
    console.log(`➡ Contract: ${CONTRACT_ADDRESS}`);
    console.log(`➡ Prover:   ${PROVER_ADDRESS}`);
    console.log(`➡ Query ID: ${QUERY_ID}`);
    console.log(`➡ ERC20:    ${ERC20_ADDRESS}`);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, USCBridgeABI, signer);

    try {
        // Check balance and estimate gas
        const balance = await provider.getBalance(signer.address);
        console.log("Caller has balance (native):", ethers.formatEther(balance));

        await grantAdminRoleToBridge(ERC20_ADDRESS, CONTRACT_ADDRESS);

        // Get query details
        const queryDetails = await fetchQueryDetails(PROVER_ADDRESS, QUERY_ID);
        console.log("ℹ️ Query Principal:", queryDetails.principal);
        // Check that primary in query details == bridge contract authority
        // We skip this check in hello-bridge, since this safeguard is disabled in the tutorial smart contract.
        //checkAdmin(queryDetails.principal, contract);
        // Check that the query has at least 8 result segments
        const segments = queryDetails.resultSegments;
        // Check that the query hasn't been used yet in our Universal Smart Contract
        checkIfQueryUsed(CONTRACT_ADDRESS, PROVER_ADDRESS, QUERY_ID);
        // Check that the query isn't currently locked
        checkIfQueryIsLocked(CONTRACT_ADDRESS, PROVER_ADDRESS, QUERY_ID);
        // Check result segments
        if (!validateResultSegments(segments)) {
            console.warn("❌ Segment validation failed. Aborting mint.");
            return;
        }
        // Check that query wasn't already used on this ERC20
        await checkIfQueryUsedByERC20(CONTRACT_ADDRESS, ERC20_ADDRESS, QUERY_ID);
        // Check that the bridge contract has admin role on the ERC20 contract, so that mint is possible
        checkErc20AdminPermission(ERC20_ADDRESS, CONTRACT_ADDRESS);

        // Make the call
        const tx = await contract.uscBridgeCompleteMint(
            PROVER_ADDRESS,
            QUERY_ID,
            ERC20_ADDRESS
        );
        console.log("⏳ Transaction submitted. Hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block", receipt.blockNumber);
    } catch (err) {
        console.error("❌ Transaction failed:", err);
    }
}

main();

async function fetchQueryDetails(proverAddress, queryId) {
    const prover = new ethers.Contract(proverAddress, ProverABI, provider);
    try {
        const queryDetails = await prover.getQueryDetails(queryId);
        return queryDetails;
    } catch (err) {
        console.error("❌ Failed to fetch queryDetails:", err);
        return null;
    }
}

async function checkIfQueryUsed(contractAddress, proverAddress, queryId) {
    const contract = new ethers.Contract(contractAddress, USCBridgeABI, provider);

    try {
        const used = await contract.isQueryUsed(proverAddress, queryId);
        if (used) {
            console.warn(`❌ Query ID ${queryId} was already used by ${proverAddress}`);
        } else {
            console.log(`✅ Query ID ${queryId} has NOT been used by ${proverAddress}`);
        }
        return used;
    } catch (err) {
        console.error("❌ Failed to check if query was used:", err);
        return null;
    }
}

async function checkIfQueryIsLocked(contractAddress, proverAddress, queryId) {
    const contract = new ethers.Contract(contractAddress, USCBridgeABI, provider);

    try {
        const [amount, unlockTime] = await contract.getLockedQuery(proverAddress, queryId);
        const isLocked = unlockTime > 0;

        if (isLocked) {
            console.log(`❌ Query is LOCKED.`);
            console.log(`   → Amount: ${ethers.formatUnits(amount, 18)}`);
            console.log(`   → Unlock Time (unix): ${unlockTime}`);
            console.log(`   → Unlock Time (UTC): ${new Date(unlockTime * 1000).toISOString()}`);
        } else {
            console.log("✅ Query is NOT locked.");
        }

        return isLocked;
    } catch (err) {
        console.error("❌ Failed to check lock status:", err);
        return null;
    }
}

function validateResultSegments(segments) {
    if (!segments || segments.length < 8) {
        console.warn(`❌ ERC 20 transfers should have at least 8 result segments, got ${segments.length}`);
        return false;
    }

    // Parse addresses and amount
    const fromAddress = ethers.getAddress(
        ethers.zeroPadValue(
            ethers.hexlify(segments[5].abiBytes),
            32
        ).slice(26) // last 20 bytes
    );

    const toAddress = ethers.getAddress(
        ethers.zeroPadValue(
            ethers.hexlify(segments[6].abiBytes),
            32
        ).slice(26)
    );

    const amount = BigInt(segments[7].abiBytes);

    console.log("📦 Decoded Result Segment Values:");
    console.log(`   From:   ${fromAddress}`);
    console.log(`   To:     ${toAddress}`);
    console.log(`   Amount: ${ethers.formatUnits(amount, 18)}`);

    // === Match smart contract checks ===
    if (amount <= 0n) {
        console.error("❌ No amount to send");
        return false;
    }

    if (BigInt(toAddress) >= 128n) {
        console.error("❌ Not a valid burn address");
        return false;
    }

    if (fromAddress === ethers.ZeroAddress) {
        console.error("❌ Invalid address to mint ERC20");
        return false;
    }

    console.log("✅ Segment validation passed. No issues with from addr, to addr, or mint amount.");
    return true;
}

async function checkIfQueryUsedByERC20(contractAddress, erc20Address, queryId) {
    const contract = new ethers.Contract(contractAddress, USCBridgeABI, provider);

    try {
        const used = await contract.isQueryUsed(erc20Address, queryId);
        if (used) {
            console.warn(`❌ Query ID ${queryId} was already used by ERC20 token ${erc20Address}`);
        } else {
            console.log(`✅ Query ID ${queryId} has NOT been used by ERC20 token ${erc20Address}`);
        }
        return used;
    } catch (err) {
        console.error("❌ Failed to check if query was used by ERC20:", err);
        return null;
    }
}

async function checkErc20AdminPermission(erc20Address, bridgeAddress) {
    const erc20Abi = [
        "function hasRole(bytes32 role, address account) view returns (bool)"
    ];

    const erc20 = new ethers.Contract(erc20Address, erc20Abi, provider);
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

    try {
        const isAdmin = await erc20.hasRole(DEFAULT_ADMIN_ROLE, bridgeAddress);
        if (isAdmin) {
            console.log(`✅ USCBridge contract HAS DEFAULT_ADMIN_ROLE on ERC20`);
        } else {
            console.warn(`❌ USCBridge contract does NOT have DEFAULT_ADMIN_ROLE on ERC20!`);
        }
    } catch (err) {
        console.warn("⚠️ Could not check DEFAULT_ADMIN_ROLE on ERC20:", err.reason || err.message);
    }
}

async function grantAdminRoleToBridge(erc20Address, bridgeAddress) {
    const erc20Abi = [
        "function grantRole(bytes32 role, address account) external",
        "function hasRole(bytes32 role, address account) view returns (bool)"
    ];
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

    const erc20 = new ethers.Contract(erc20Address, erc20Abi, signer);

    try {
        const alreadyHasRole = await erc20.hasRole(DEFAULT_ADMIN_ROLE, bridgeAddress);
        if (alreadyHasRole) {
            console.log(`✅ Bridge contract already has DEFAULT_ADMIN_ROLE on ERC20`);
            return;
        }

        const tx = await erc20.grantRole(DEFAULT_ADMIN_ROLE, bridgeAddress);
        console.log(`⏳ Granting DEFAULT_ADMIN_ROLE on mintable to bridge ${bridgeAddress}... TX: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Role granted in block ${receipt.blockNumber}`);
    } catch (err) {
        console.error("❌ Failed to grant admin role to bridge contract:", err);
    }
}