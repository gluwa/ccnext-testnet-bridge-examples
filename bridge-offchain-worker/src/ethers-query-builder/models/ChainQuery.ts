export type ChainQuery = {
  chainId: bigint;
  height: bigint;
  index: bigint;
  layoutSegments: LayoutSegmentType[];
}

export type LayoutSegmentType = {
  offset: bigint;
  size: bigint;
}