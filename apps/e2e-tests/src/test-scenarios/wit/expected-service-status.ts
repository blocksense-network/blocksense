export const expectedPCStatuses03 = {
  'anvil-impersonate-and-fund-ink-sepolia': {
    status: 'Completed',
    exit_code: 0,
  },
  'anvil-ink-sepolia': {
    status: 'Running',
    exit_code: 0,
  },
  'blocksense-reporter-a': {
    status: 'Running',
    exit_code: 0,
  },
  'blocksense-sequencer': {
    status: 'Running',
    exit_code: 0,
  },
};

export const expectedProcessesStatus = {
  ...expectedPCStatuses03,
  'aggregate-consensus-reader': {
    status: 'Running',
    exit_code: 0,
  },
  'anvil-impersonate-and-fund-ethereum-sepolia': {
    status: 'Completed',
    exit_code: 0,
  },
  'anvil-ethereum-sepolia': {
    status: 'Running',
    exit_code: 0,
  },
  'blockchain-reader': {
    status: 'Running',
    exit_code: 0,
  },
  kafka: {
    status: 'Running',
    exit_code: 0,
  },
  blama: {
    status: 'Running',
    exit_code: 0,
  },
};
