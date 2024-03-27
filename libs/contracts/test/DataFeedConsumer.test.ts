import { ethers, network } from "hardhat";
import { IDataFeedStore, DataFeedV1Consumer, DataFeedV2Consumer, DataFeedGenericConsumer, DataFeedStoreGeneric } from "../typechain";
import { expect } from "chai";
import { setter } from "./uitls";

describe('DataFeedConsumer', function () {
    let dataFeedStoreGeneric: DataFeedStoreGeneric;
    let dataFeedGenericConsumer: DataFeedGenericConsumer;

    beforeEach(async function () {
        const DataFeedStoreGeneric = await ethers.getContractFactory('DataFeedStoreGeneric');
        dataFeedStoreGeneric = await (await DataFeedStoreGeneric.deploy()).waitForDeployment();

        const DataFeedConsumer = await ethers.getContractFactory('DataFeedGenericConsumer');
        dataFeedGenericConsumer = await (await DataFeedConsumer.deploy(await dataFeedStoreGeneric.getAddress())).waitForDeployment();
    });

    describe('DataFeedStoreV1', function () {
        let dataFeedV1Consumer: DataFeedV1Consumer;
        let dataFeedStoreV1: IDataFeedStore;

        beforeEach(async function () {
            const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
            const _dataFeedStore = await DataFeedStore.deploy();
            await _dataFeedStore.waitForDeployment();

            dataFeedStoreV1 = await ethers.getContractAt('IDataFeedStore', await _dataFeedStore.getAddress());

            const DataFeedV1Consumer = await ethers.getContractFactory('DataFeedV1Consumer');
            dataFeedV1Consumer = await (await DataFeedV1Consumer.deploy(await dataFeedStoreV1.getAddress())).waitForDeployment();
        });

        it('Should read the data feed with the fallback function', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            await setter(dataFeedStoreV1, dataFeedStoreV1.interface.getFunction("setFeeds").selector, [key], [value]);

            const feed = await dataFeedV1Consumer.getExternalFeedById(key);
            expect(feed).to.equal(value);
        });

        it('Should get the value from the DataFeedStore and store it in the contract', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            await setter(dataFeedStoreV1, dataFeedStoreV1.interface.getFunction("setFeeds").selector, [key], [value]);

            await dataFeedStoreGeneric.setFeeds([key], [value]);

            const receipt = await (await dataFeedV1Consumer.setFetchedFeedById(key)).wait();
            const receiptGeneric = await (await dataFeedGenericConsumer.setFetchedFeedById(key)).wait();

            const storedValue = await dataFeedV1Consumer.getFeedById(key);
            const storedValueGeneric = await dataFeedGenericConsumer.getFeedById(key);

            expect(storedValue).to.equal(storedValueGeneric);

            console.log('[v1] gas used: ', receipt?.gasUsed.toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });

        it('Should fetch and set multiple feeds in a single transaction', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            await setter(dataFeedStoreV1, dataFeedStoreV1.interface.getFunction("setFeeds").selector, keys, values);

            await dataFeedStoreGeneric.setFeeds(keys, values);

            const receipt = await (await dataFeedV1Consumer.setMultipleFetchedFeedsById(keys)).wait();
            const receiptGeneric = await (await dataFeedGenericConsumer.setMultipleFetchedFeedsById(keys)).wait();

            console.log('[v1] gas used: ', receipt?.gasUsed.toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });
    });

    describe(`DataFeedStoreV2`, function () {
        let dataFeedStore: IDataFeedStore;
        let dataFeedConsumer: DataFeedV2Consumer;

        beforeEach(async function () {
            const DataFeedStore = await ethers.getContractFactory(`DataFeedStoreV2`);
            const _dataFeedStore = await DataFeedStore.deploy();
            await _dataFeedStore.waitForDeployment();

            dataFeedStore = await ethers.getContractAt('IDataFeedStore', await _dataFeedStore.getAddress());

            const DataFeedConsumer = await ethers.getContractFactory('DataFeedV2Consumer');
            dataFeedConsumer = await (await DataFeedConsumer.deploy(await dataFeedStore.getAddress())).waitForDeployment();
        });

        it('Should read the data feed with the fallback function', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            await setter(dataFeedStore, dataFeedStore.interface.getFunction("setFeeds").selector, [key], [value]);

            const feed = await dataFeedConsumer.getExternalFeedById(key);
            expect(feed).to.equal(value);
        });

        it('Should get the value from the DataFeedStore and store it in the contract', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            await setter(dataFeedStore, dataFeedStore.interface.getFunction("setFeeds").selector, [key], [value]);

            await dataFeedStoreGeneric.setFeeds([key], [value]);

            const receipt = await (await dataFeedConsumer.setFetchedFeedById(key)).wait();
            const receiptGeneric = await (await dataFeedGenericConsumer.setFetchedFeedById(key)).wait();

            const storedValue = await dataFeedConsumer.getFeedById(key);
            const storedValueGeneric = await dataFeedGenericConsumer.getFeedById(key);

            expect(storedValue).to.equal(storedValueGeneric);

            console.log(`[v2] gas used: `, receipt?.gasUsed.toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });

        it('Should fetch and set multiple feeds in a single transaction', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            await setter(dataFeedStore, dataFeedStore.interface.getFunction("setFeeds").selector, keys, values);

            await dataFeedStoreGeneric.setFeeds(keys, values);

            const receipt = await (await dataFeedConsumer.setMultipleFetchedFeedsById(keys)).wait();
            const receiptGeneric = await (await dataFeedGenericConsumer.setMultipleFetchedFeedsById(keys)).wait();

            console.log(`[v2] gas used: `, receipt?.gasUsed.toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt?.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });
    });
});