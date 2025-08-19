import { ChainQuery } from "./ethers-query-builder/models/ChainQuery";
import { PROVER_ABI } from "./constants/abi";
import { encodeAbiParameters } from "viem";
import { keccak256 } from "viem";

// The prover contract needs to know what source chain the query is from
// But the chainId which the prover contract expects is different from the chainId of the source chain
// So we have to convert the chainId of the source chain to the chainId that the prover contract expects
export const chainKeyConverter = (chainId: number): bigint => {
  switch(chainId) {
    //case 1:
    //  return 1n;
    //case 31337:
    //  return 2n;
    // Sepolia is the only supported chain key on testnet at the moment
    case 11155111:
      return 1n;
    default:
      throw new Error("UnsupportedChainId")
  }
}

export const computeQueryId = (queryObject: ChainQuery): `0x${string}` => {
  const queryAbi = PROVER_ABI.find(
    (abiElement) => abiElement.type === 'function' && abiElement.name === 'computeQueryCost')!.inputs;
  const queryAbiEncoded = encodeAbiParameters(
    queryAbi,
    [{
      chainId: queryObject.chainId,
      height: queryObject.height,
      index: queryObject.index,
      layoutSegments: queryObject.layoutSegments.map(segment => ({
        offset: segment.offset,
        size: segment.size
      }))
    }]
  );
  return keccak256(queryAbiEncoded)
}