import { CLAggregatorAdapter } from './CLAggregatorAdapter';

const adapter = new CLAggregatorAdapter(
  '0x401e09ddF0391AC421d6dEcfe2BcA0a36934aD7e',
  'monad-testnet',
);

const id = await adapter.id();
console.log('ID:', id);

const decimals = await adapter.decimals();
console.log('Decimals:', decimals);

const latest = await adapter.latestRoundData();
console.log('Latest round data:', latest);

const latestAnswer = await adapter.latestAnswer();
console.log('Latest answer:', latestAnswer);

const latestRound = await adapter.latestRound();
console.log('Latest round:', latestRound);

const description = await adapter.description();
console.log('Description:', description);

const dataFeedStore = await adapter.dataFeedStore();
console.log('Data Feed Store:', dataFeedStore);

const roundData = await adapter.getRoundData(1n);
console.log('Round Data for Round 1:', roundData);

const results = await adapter.getCLAggregatorAdapterData();
console.log('Multicall Results:', results);
