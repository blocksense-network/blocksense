'use server';
import { CLAggregatorAdapterConsumer } from '@blocksense/contracts/viem';
import type { NetworkName } from '@blocksense/base-utils';

export async function getPriceAndDecimalsAction(
  contractAddress: `0x${string}`,
  networkParam: NetworkName,
) {
  const consumer = CLAggregatorAdapterConsumer.createConsumerByNetworkName(
    contractAddress as `0x${string}`,
    networkParam,
  );
  const decimals = await consumer.getDecimals();
  const latestAnswer = await consumer.getLatestAnswer();
  const price = Number(latestAnswer) / 10 ** decimals;
  return { price, decimals };
}
