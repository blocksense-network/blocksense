import { ethers } from 'hardhat';

export const getLatestSingleData = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [, id] = feedData;

  const data = ethers.solidityPacked(['bytes1', 'uint128'], ['0x82', id]);

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getLatestData = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id] = feedData;
  const data = ethers.solidityPacked(['bytes1', 'uint128'], ['0x84', id]);

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getLatestDataSlice = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id, , startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint128', 'uint32', 'uint32'],
    ['0x84', id, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getSingleDataAtIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id, indexId] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint128', 'uint16'],
    ['0x86', id, indexId],
  );

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getDataAtIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id, indexId] = feedData;

  const data = ethers.solidityPacked(
    ['bytes1', 'uint128', 'uint16'],
    ['0x86', id, indexId],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getDataSliceAtIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id, indexId, startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint128', 'uint16', 'uint32', 'uint32'],
    ['0x86', id, indexId, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  return splitInto32bChunks(res);
};

export const getLatestIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id] = feedData;

  const data = ethers.solidityPacked(['bytes1', 'uint128'], ['0x81', id]);

  return ethers.provider.call!({
    to: adfsAddress,
    data,
  });
};

export const getLatestSingleDataAndIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id] = feedData;

  const data = ethers.solidityPacked(['bytes1', 'uint128'], ['0x83', id]);

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const index = Number(res.slice(0, 66));
  const value = '0x' + res.slice(66);
  return [value, index];
};

export const getLatestDataAndIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id] = feedData;

  const data = ethers.solidityPacked(['bytes1', 'uint128'], ['0x85', id]);

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const index = Number(res.slice(0, 66));
  const value = splitInto32bChunks('0x' + res.slice(66));
  return [value, index];
};

export const getLatestDataSliceAndIndex = async (
  adfsAddress: string,
  feedData: number[],
) => {
  const [id, , startSlot, slots] = feedData;
  const data = ethers.solidityPacked(
    ['bytes1', 'uint128', 'uint32', 'uint32'],
    ['0x85', id, startSlot, slots],
  );

  const res = await ethers.provider.call!({
    to: adfsAddress,
    data,
  });

  const index = Number(res.slice(0, 66));
  const value = splitInto32bChunks('0x' + res.slice(66));
  return [value, index];
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
