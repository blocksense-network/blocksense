'use server';
import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/viem';
import type { NetworkName } from '@blocksense/base-utils';

export async function getIsLiveAndLastUpdated(
  contractAddress: `0x${string}`,
  networkParam: NetworkName,
) {
  const consumer = CLAggregatorAdapterConsumer.createConsumerByNetworkName(
    contractAddress as `0x${string}`,
    networkParam,
  );
  const decimals = await consumer.getDecimals();
  const latestAnswer = await consumer.getLatestAnswer();
  const latestRoundData = await consumer.getLatestRoundData();
  const price = Number(latestAnswer) / 10 ** decimals;
  const lastUpdated = new Date(
    Number(latestRoundData.updatedAt) * 1000,
  ).toISOString();

  return { isLive: !!price, lastUpdated };
}
