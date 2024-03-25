import { expect } from "chai";
import { ethers, network } from "hardhat";
import { DataFeedStoreBasic, IDataFeedStore } from "../typechain";


describe.only('DataFeedStore', function () {
    let dataFeedStoreV1: IDataFeedStore;
    let dataFeedStoreV2: IDataFeedStore;
    let dataFeedStoreBasic: DataFeedStoreBasic;

    beforeEach(async function () {
        const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
        const _dataFeedStore = await DataFeedStore.deploy();
        await _dataFeedStore.waitForDeployment();

        dataFeedStoreV1 = await ethers.getContractAt('IDataFeedStore', await _dataFeedStore.getAddress());

        const DataFeedStoreV2 = await ethers.getContractFactory('DataFeedStoreV2');
        const _dataFeedStoreV2 = await DataFeedStoreV2.deploy();
        await _dataFeedStoreV2.waitForDeployment();

        dataFeedStoreV2 = await ethers.getContractAt('IDataFeedStore', await _dataFeedStoreV2.getAddress());

        const DataFeedStoreBasic = await ethers.getContractFactory('DataFeedStoreBasic');
        dataFeedStoreBasic = await DataFeedStoreBasic.deploy();
        await dataFeedStoreBasic.waitForDeployment();
    })

    describe('DataFeedStoreV1', function () {
        it('Should be able to set v1 data feed', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            const selector = dataFeedStoreV1.interface.getFunction("setFeeds").selector;
            await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                },
            ])

            const msgData = ethers.solidityPacked(["bytes4"], ["0x00000003"])
            const res = await network.provider.send("eth_call", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: msgData,
                },
                "latest",
            ]);

            expect(res).to.be.eq(value);
        });

        it('Should be able to set multiple v1 data feeds', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            const selector = dataFeedStoreV1.interface.getFunction("setFeeds").selector;
            await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                        [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                },
            ])

            for (let i = 0; i < keys.length; i++) {
                const msgData = ethers.solidityPacked(["bytes4"], [`0x0000000${keys[i]}`])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await dataFeedStoreV1.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(values[i]);
            }
        })

        it('Should compare v1 with basic', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            const selector = dataFeedStoreV1.interface.getFunction("setFeeds").selector;
            const txHash = await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                },
            ])

            const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

            const msgData = ethers.solidityPacked(["bytes4"], ["0x00000003"])
            const res = await network.provider.send("eth_call", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: msgData,
                },
                "latest",
            ]);

            expect(res).to.be.eq(value);

            const receiptBasic = await (await dataFeedStoreBasic.setFeedById(key, value)).wait();

            console.log('[v1] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[basic] gas used: ', receiptBasic?.gasUsed.toString());
        });

        it('Should compare v1 with basic multiple set', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            const selector = dataFeedStoreV1.interface.getFunction("setFeeds").selector;
            const txHash = await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                        [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                },
            ])

            const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

            const receiptBasic = await (await dataFeedStoreBasic.setFeeds(keys, values)).wait();

            console.log('[v1] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[basic] gas used: ', receiptBasic?.gasUsed.toString());
        });
    });

    describe('DataFeedStoreV2', function () {
        it('Should be able to set v2 data feed', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            const selector = dataFeedStoreV2.interface.getFunction("setFeeds").selector;
            await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                },
            ]);

            const msgData = ethers.solidityPacked(["bytes4"], ["0x80000003"])
            const res = await network.provider.send("eth_call", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: msgData,
                },
                "latest",
            ]);

            expect(res).to.be.eq(value);
        });

        it('Should compare v2 with basic', async function () {
            const key = 3;
            const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
            const selector = dataFeedStoreV2.interface.getFunction("setFeeds").selector;
            const txHash = await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                },
            ])
            const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

            const msgData = ethers.solidityPacked(["bytes4"], ["0x80000003"])
            const res = await network.provider.send("eth_call", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: msgData,
                },
                "latest",
            ]);

            expect(res).to.be.eq(value);

            const receiptBasic = await (await dataFeedStoreBasic.setFeedById(key, value)).wait();

            console.log('[v2] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[basic] gas used: ', receiptBasic?.gasUsed.toString());

            expect(parseInt(receipt.gasUsed, 16)).to.be.lt(receiptBasic?.gasUsed);
        });

        it('Should be able to set multiple v2 data feeds', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            const selector = dataFeedStoreV2.interface.getFunction("setFeeds").selector;
            await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                        [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                },
            ]);

            for (let i = 0; i < keys.length; i++) {
                const msgData = ethers.solidityPacked(["bytes4"], [`0x8000000${keys[i]}`])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await dataFeedStoreV2.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(values[i]);
            }
        });

        it('Should compare v2 with basic multiple set', async function () {
            const keys = Array.from({ length: 10 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            const selector = dataFeedStoreV2.interface.getFunction("setFeeds").selector;
            const txHash = await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV2.getAddress(),
                    data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                        [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                },
            ])

            const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

            const receiptBasic = await (await dataFeedStoreBasic.setFeeds(keys, values)).wait();

            console.log('[v2] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[basic] gas used: ', receiptBasic?.gasUsed.toString());
        });
    });
});