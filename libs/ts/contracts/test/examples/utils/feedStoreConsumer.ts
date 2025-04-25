import { ethers } from 'hardhat';

export const getLatestSingleFeedData = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [, key] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120'],
    ['0x82', 0, key],
  );

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getLatestFeedData = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120'],
    ['0x84', stride, key],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getLatestSlicedFeedData = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key, , startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120', 'uint32', 'uint32'],
    ['0x84', stride, key, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getSingleFeedDataAtRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [, key, roundId] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120', 'uint16'],
    ['0x86', 0, key, roundId],
  );

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getFeedDataAtRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key, roundId] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120', 'uint16'],
    ['0x86', stride, key, roundId],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getSlicedFeedDataAtRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key, roundId, startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120', 'uint16', 'uint32', 'uint32'],
    ['0x86', stride, key, roundId, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getLatestRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120'],
    ['0x81', stride ?? 0n, key],
  );

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getLatestSingleFeedDataAndRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [, key] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120'],
    ['0x83', 0, key],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const round = Number(res.slice(0, 66));
  const value = '0x' + res.slice(66);
  return [value, round];
};

export const getLatestFeedDataAndRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120'],
    ['0x85', stride, key],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const round = Number(res.slice(0, 66));
  const value = splitInto32bChunks('0x' + res.slice(66));
  return [value, round];
};

export const getLatestSlicedFeedDataAndRound = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [stride, key, , startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint8', 'uint120', 'uint32', 'uint32'],
    ['0x85', stride, key, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const round = Number(res.slice(0, 66));
  const value = splitInto32bChunks('0x' + res.slice(66));
  return [value, round];
};

const splitInto32bChunks = (value: string) => {
  // split the result into an array of chunks of 64 characters (32b) each
  const regex = new RegExp(`(.{1,${64}})`, 'g');
  return value
    .slice(2)
    .split(regex)
    .filter(chunk => chunk.length > 0)
    .map(chunk => '0x' + chunk);
};
