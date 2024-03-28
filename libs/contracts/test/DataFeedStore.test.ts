import { expect } from "chai";
import { ethers, network } from "hardhat";
import { DataFeedStoreGeneric, IDataFeedStore, DataFeedStoreGenericV2 } from "../typechain";
import { compareGasUsed, getV1Selector, getV2Selector, getter, setter } from "./uitls";

const contracts: { [key: string]: IDataFeedStore } = {};

describe('DataFeedStore', function () {
    let dataFeedStoreGenericV1: DataFeedStoreGeneric;
    let dataFeedStoreGenericV2: DataFeedStoreGenericV2;
    let dataFeedStoreV1: IDataFeedStore;
    let dataFeedStoreV2: IDataFeedStore;
    let dataFeedStoreV3: IDataFeedStore;

    beforeEach(async function () {
        const DataFeedStoreGeneric = await ethers.getContractFactory('DataFeedStoreGeneric');
        dataFeedStoreGenericV1 = await DataFeedStoreGeneric.deploy();
        await dataFeedStoreGenericV1.waitForDeployment();

        const DataFeedStoreGenericV2 = await ethers.getContractFactory('DataFeedStoreGenericV2');
        dataFeedStoreGenericV2 = await DataFeedStoreGenericV2.deploy();
        await dataFeedStoreGenericV2.waitForDeployment();

        const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
        const _dataFeedStore = await DataFeedStore.deploy();
        await _dataFeedStore.waitForDeployment();

        const tx = await _dataFeedStore.deploymentTransaction()?.getTransaction()

        console.log('DataFeedStoreV1 deployment gas used: ', +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash])).gasUsed);

        dataFeedStoreV1 = await ethers.getContractAt('IDataFeedStore', await _dataFeedStore.getAddress());
        contracts.V1 = dataFeedStoreV1;

        const DataFeedStoreV2 = await ethers.getContractFactory(`DataFeedStoreV2`);
        const _contract2 = await DataFeedStoreV2.deploy();
        await _contract2.waitForDeployment();

        dataFeedStoreV2 = await ethers.getContractAt('IDataFeedStore', await _contract2.getAddress());

        const tx2 = await _contract2.deploymentTransaction()?.getTransaction()

        console.log(`DataFeedStoreV2 deployment gas used: `, +(await network.provider.send('eth_getTransactionReceipt', [tx2?.hash])).gasUsed);
        contracts.V2 = dataFeedStoreV2;

        const DataFeedStoreV3 = await ethers.getContractFactory(`DataFeedStoreV3`);
        const _contract3 = await DataFeedStoreV3.deploy();
        await _contract3.waitForDeployment();

        dataFeedStoreV3 = await ethers.getContractAt('IDataFeedStore', await _contract3.getAddress());

        const tx3 = await _contract3.deploymentTransaction()?.getTransaction()

        console.log(`DataFeedStoreV2 deployment gas used: `, +(await network.provider.send('eth_getTransactionReceipt', [tx3?.hash])).gasUsed);
        contracts.V3 = dataFeedStoreV3;
    })

    describe('DataFeedStoreV1', function () {
        it('Should be able to set v1 data feed', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            await setter(dataFeedStoreV1, dataFeedStoreV1.interface.getFunction("setFeeds").selector, [key], [value]);

            const res = await getter(dataFeedStoreV1, getV1Selector(key));
            expect(res).to.be.eq(value);
        });

        it('Should be able to set multiple v1 data feeds', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            await setter(dataFeedStoreV1, dataFeedStoreV1.interface.getFunction("setFeeds").selector, keys, values);

            for (let i = 0; i < keys.length; i++) {
                const res = await getter(dataFeedStoreV1, getV1Selector(keys[i]));
                expect(res).to.be.eq(values[i]);
            }
        })

        it('Should compare v1 with Generic for max set', async function () {
            const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, [dataFeedStoreV1], dataFeedStoreV1.interface.getFunction("setFeeds").selector, 255);
            expect(receipts[0].gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });

        it('Should compare v1 with GenericV2 for max set', async function () {
            const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV2, [dataFeedStoreV1], dataFeedStoreV1.interface.getFunction("setFeeds").selector, 255);
            expect(receipts[0].gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });
    });

    for (let i = 2; i <= 3; i++) {
        describe(`DataFeedStoreV${i}`, function () {
            let contract: IDataFeedStore;

            beforeEach(async function () {
                const keys = Object.keys(contracts);
                contract = contracts[keys[i - 1]];
            });

            it(`Should be able to set v${i} data feed`, async function () {
                const key = 3;
                const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
                await setter(contract, contract.interface.getFunction("setFeeds").selector, [key], [value]);

                const res = await getter(contract, getV2Selector(key));
                expect(res).to.be.eq(value);
            });

            it(`Should be able to set multiple v${i} data feeds`, async function () {
                const keys = Array.from({ length: 10 }, (_, i) => i);
                const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
                await setter(contract, contract.interface.getFunction("setFeeds").selector, keys, values);

                for (let i = 0; i < keys.length; i++) {
                    const res = await getter(contract, getV2Selector(keys[i]));

                    expect(res).to.be.eq(values[i]);
                }
            });

            it(`Should compare v${i} with Generic for 100 smallest uint32 id set`, async function () {
                const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, [contract], contract.interface.getFunction("setFeeds").selector, 100);
                expect(receipts[0].gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it(`Should compare v${i} with Generic for 100 biggest uint32 id set`, async function () {
                const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, [contract], contract.interface.getFunction("setFeeds").selector, 100, 2147483548);
                expect(receipts[0].gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it('Should test with the biggest possible id', async function () {
                const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, [contract], contract.interface.getFunction("setFeeds").selector, 1, 0x7fffffff);
                expect(receipts[0].gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });
        });
    }

    it('Should compare versions with Generic', async function () {
        const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, Object.values(contracts), dataFeedStoreV1.interface.getFunction("setFeeds").selector, 1);
        for (const receipt of receipts) {
            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        }
    });

    it('Should compare versions with Generic for 10 set', async function () {
        const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV1, Object.values(contracts), dataFeedStoreV1.interface.getFunction("setFeeds").selector, 10);
        for (const receipt of receipts) {
            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        }
    });

    it('Should compare versions with GenericV2', async function () {
        const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV2, Object.values(contracts), dataFeedStoreV1.interface.getFunction("setFeeds").selector, 1);
        for (const receipt of receipts) {
            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        }
    });

    it('Should compare versions with GenericV2 for 10 set', async function () {
        const { receipts, receiptGeneric } = await compareGasUsed(dataFeedStoreGenericV2, Object.values(contracts), dataFeedStoreV1.interface.getFunction("setFeeds").selector, 10);
        for (const receipt of receipts) {
            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        }
    });
});