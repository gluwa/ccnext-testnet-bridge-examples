export const PROVER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_proceedsAccount', type: 'address' },
      { internalType: 'uint256', name: '_costPerByte', type: 'uint256' },
      { internalType: 'uint256', name: '_baseFee', type: 'uint256' },
      { internalType: 'uint64', name: '_chainKey', type: 'uint64' },
      { internalType: 'string', name: '_displayName', type: 'string' },
      { internalType: 'uint64', name: '_timeout', type: 'uint64' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newBaseFee',
        type: 'uint256',
      },
    ],
    name: 'BaseFeeUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newCostPerByte',
        type: 'uint256',
      },
    ],
    name: 'CostPerByteUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'QueryId',
        name: 'queryId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'escrowedAmount',
        type: 'uint256',
      },
    ],
    name: 'EscrowedPaymentReclaimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'proceedsAccount',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'ProceedsWithdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'contractAddress',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'proceedsAccount',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'costPerByte',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'baseFee',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'chainKey',
        type: 'uint64',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'displayName',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'timeout',
        type: 'uint64',
      },
    ],
    name: 'ProverDeployed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'QueryId',
        name: 'queryId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'reason',
        type: 'string',
      },
    ],
    name: 'QueryProofVerificationFailed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'QueryId',
        name: 'queryId',
        type: 'bytes32',
      },
      {
        components: [
          { internalType: 'uint256', name: 'offset', type: 'uint256' },
          { internalType: 'bytes32', name: 'abiBytes', type: 'bytes32' },
        ],
        indexed: false,
        internalType: 'struct ResultSegment[]',
        name: 'resultSegments',
        type: 'tuple[]',
      },
      {
        indexed: false,
        internalType: 'enum QueryState',
        name: 'state',
        type: 'uint8',
      },
    ],
    name: 'QueryProofVerified',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'QueryId',
        name: 'queryId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'estimatedCost',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'escrowedAmount',
        type: 'uint256',
      },
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          { internalType: 'uint64', name: 'height', type: 'uint64' },
          { internalType: 'uint64', name: 'index', type: 'uint64' },
          {
            components: [
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'size', type: 'uint64' },
            ],
            internalType: 'struct LayoutSegment[]',
            name: 'layoutSegments',
            type: 'tuple[]',
          },
        ],
        indexed: false,
        internalType: 'struct ChainQuery',
        name: 'chainQuery',
        type: 'tuple',
      },
    ],
    name: 'QuerySubmitted',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'QueryId', name: 'queryId', type: 'bytes32' },
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
    ],
    name: '_call_verifier_verify',
    outputs: [
      {
        components: [
          {
            internalType: 'enum VerifierExitStatus',
            name: 'status',
            type: 'uint8',
          },
          {
            components: [
              { internalType: 'uint256', name: 'offset', type: 'uint256' },
              { internalType: 'bytes32', name: 'abiBytes', type: 'bytes32' },
            ],
            internalType: 'struct ResultSegment[]',
            name: 'resultSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct VerifierResult',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'baseFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          { internalType: 'uint64', name: 'height', type: 'uint64' },
          { internalType: 'uint64', name: 'index', type: 'uint64' },
          {
            components: [
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'size', type: 'uint64' },
            ],
            internalType: 'struct LayoutSegment[]',
            name: 'layoutSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct ChainQuery',
        name: 'query',
        type: 'tuple',
      },
    ],
    name: 'computeQueryCost',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'costPerByte',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'displayName',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'queryId', type: 'bytes32' }],
    name: 'getQueryDetails',
    outputs: [
      {
        components: [
          { internalType: 'enum QueryState', name: 'state', type: 'uint8' },
          {
            components: [
              { internalType: 'uint64', name: 'chainId', type: 'uint64' },
              { internalType: 'uint64', name: 'height', type: 'uint64' },
              { internalType: 'uint64', name: 'index', type: 'uint64' },
              {
                components: [
                  { internalType: 'uint64', name: 'offset', type: 'uint64' },
                  { internalType: 'uint64', name: 'size', type: 'uint64' },
                ],
                internalType: 'struct LayoutSegment[]',
                name: 'layoutSegments',
                type: 'tuple[]',
              },
            ],
            internalType: 'struct ChainQuery',
            name: 'query',
            type: 'tuple',
          },
          { internalType: 'Balance', name: 'escrowedAmount', type: 'uint256' },
          { internalType: 'address', name: 'principal', type: 'address' },
          { internalType: 'Balance', name: 'estimatedCost', type: 'uint256' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          {
            components: [
              { internalType: 'uint256', name: 'offset', type: 'uint256' },
              { internalType: 'bytes32', name: 'abiBytes', type: 'bytes32' },
            ],
            internalType: 'struct ResultSegment[]',
            name: 'resultSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct QueryDetails',
        name: 'queryDetails',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getUnprocessedQueries',
    outputs: [
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          { internalType: 'uint64', name: 'height', type: 'uint64' },
          { internalType: 'uint64', name: 'index', type: 'uint64' },
          {
            components: [
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'size', type: 'uint64' },
            ],
            internalType: 'struct LayoutSegment[]',
            name: 'layoutSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct ChainQuery[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'QueryId', name: 'queryId', type: 'bytes32' }],
    name: 'isQueryTimedOut',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'QueryId', name: 'queryId', type: 'bytes32' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    name: 'markAsInvalid',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'QueryId', name: '', type: 'bytes32' }],
    name: 'queries',
    outputs: [
      { internalType: 'enum QueryState', name: 'state', type: 'uint8' },
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          { internalType: 'uint64', name: 'height', type: 'uint64' },
          { internalType: 'uint64', name: 'index', type: 'uint64' },
          {
            components: [
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'size', type: 'uint64' },
            ],
            internalType: 'struct LayoutSegment[]',
            name: 'layoutSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct ChainQuery',
        name: 'query',
        type: 'tuple',
      },
      { internalType: 'Balance', name: 'escrowedAmount', type: 'uint256' },
      { internalType: 'address', name: 'principal', type: 'address' },
      { internalType: 'Balance', name: 'estimatedCost', type: 'uint256' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'queryIds',
    outputs: [{ internalType: 'QueryId', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'QueryId', name: 'queryId', type: 'bytes32' }],
    name: 'reclaimEscrowedPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'uint64', name: 'chainId', type: 'uint64' },
          { internalType: 'uint64', name: 'height', type: 'uint64' },
          { internalType: 'uint64', name: 'index', type: 'uint64' },
          {
            components: [
              { internalType: 'uint64', name: 'offset', type: 'uint64' },
              { internalType: 'uint64', name: 'size', type: 'uint64' },
            ],
            internalType: 'struct LayoutSegment[]',
            name: 'layoutSegments',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct ChainQuery',
        name: 'query',
        type: 'tuple',
      },
      { internalType: 'address', name: 'principal', type: 'address' },
    ],
    name: 'submitQuery',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'QueryId', name: 'queryId', type: 'bytes32' },
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
    ],
    name: 'submitQueryProof',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'offset', type: 'uint256' },
          { internalType: 'bytes32', name: 'abiBytes', type: 'bytes32' },
        ],
        internalType: 'struct ResultSegment[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_newBaseFee', type: 'uint256' }],
    name: 'updateBaseFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_newCostPerByte', type: 'uint256' },
    ],
    name: 'updateCostPerByte',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdrawProceeds',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
