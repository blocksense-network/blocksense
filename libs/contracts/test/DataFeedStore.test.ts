import { expect } from "chai";
import { ethers, network } from "hardhat";
import { DataFeedStoreGeneric, IDataFeedStore } from "../typechain";

describe('DataFeedStore', function () {
    let dataFeedStoreGeneric: DataFeedStoreGeneric;

    beforeEach(async function () {
        const DataFeedStoreGeneric = await ethers.getContractFactory('DataFeedStoreGeneric');
        dataFeedStoreGeneric = await DataFeedStoreGeneric.deploy();
        await dataFeedStoreGeneric.waitForDeployment();
    })

    describe('DataFeedStoreV1', function () {
        let dataFeedStoreV1: IDataFeedStore;

        beforeEach(async function () {
            const DataFeedStore = await ethers.getContractFactory('DataFeedStoreV1');
            const _dataFeedStore = await DataFeedStore.deploy();
            await _dataFeedStore.waitForDeployment();

            const tx = await _dataFeedStore.deploymentTransaction()?.getTransaction()

            console.log('DataFeedStoreV1 deployment gas used: ', +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash])).gasUsed);

            dataFeedStoreV1 = await ethers.getContractAt('IDataFeedStore', await _dataFeedStore.getAddress());
        })

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

        it('Should compare v1 with Generic', async function () {
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

            const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds([key], [value])).wait();

            console.log('[v1] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });

        it('Should compare v1 with Generic multiple set', async function () {
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

            const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds(keys, values)).wait();

            console.log('[v1] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });

        it('Should compare v1 with Generic for max set', async function () {
            const keys = Array.from({ length: 255 }, (_, i) => i);
            const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
            const selector = dataFeedStoreV1.interface.getFunction("setFeeds").selector;
            const txHash = await network.provider.send("eth_sendTransaction", [
                {
                    to: await dataFeedStoreV1.getAddress(),
                    data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                        [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                },
            ])

            for (let i = 0; i < keys.length; i++) {
                const msgData = ethers.solidityPacked(["bytes4"], ['0x' + (keys[i] >>> 0).toString(16).padStart(8, '0')])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await dataFeedStoreV1.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(values[i]);
            }

            const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

            const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds(keys, values)).wait();

            console.log('[v1] gas used: ', parseInt(receipt.gasUsed, 16).toString());
            console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

            expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
        });
    });

    for (let i = 2; i <= 3; i++) {
        describe(`DataFeedStore v${i}`, function () {
            let contract: IDataFeedStore;

            beforeEach(async function () {
                const DataFeedStore = await ethers.getContractFactory(`DataFeedStoreV${i}`);
                const _contract = await DataFeedStore.deploy();
                await _contract.waitForDeployment();

                contract = await ethers.getContractAt('IDataFeedStore', await _contract.getAddress());

                const tx = await _contract.deploymentTransaction()?.getTransaction()

                console.log(`DataFeedStoreV${i} deployment gas used: `, +(await network.provider.send('eth_getTransactionReceipt', [tx?.hash])).gasUsed);

            });

            it('Should be able to set v2 data feed', async function () {
                const key = 3;
                const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
                const selector = contract.interface.getFunction("setFeeds").selector;
                await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                    },
                ]);

                const msgData = ethers.solidityPacked(["bytes4"], ["0x80000003"])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await contract.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(value);
            });

            it('Should be able to set multiple v2 data feeds', async function () {
                const keys = Array.from({ length: 10 }, (_, i) => i);
                const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
                const selector = contract.interface.getFunction("setFeeds").selector;
                await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                            [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                    },
                ]);

                for (let i = 0; i < keys.length; i++) {
                    const msgData = ethers.solidityPacked(["bytes4"], [`0x8000000${keys[i]}`])
                    const res = await network.provider.send("eth_call", [
                        {
                            to: await contract.getAddress(),
                            data: msgData,
                        },
                        "latest",
                    ]);

                    expect(res).to.be.eq(values[i]);
                }
            });

            it('Should compare v2 with Generic', async function () {
                const key = 3;
                const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
                const selector = contract.interface.getFunction("setFeeds").selector;
                const txHash = await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                    },
                ])
                const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

                const msgData = ethers.solidityPacked(["bytes4"], ["0x80000003"])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await contract.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(value);

                const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds([key], [value])).wait();

                console.log(`[v${i}] gas used: `, parseInt(receipt.gasUsed, 16).toString());
                console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

                expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it('Should compare v2 with Generic multiple set', async function () {
                const keys = Array.from({ length: 10 }, (_, i) => i);
                const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
                const selector = contract.interface.getFunction("setFeeds").selector;
                const txHash = await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                            [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                    },
                ])

                const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

                const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds(keys, values)).wait();

                console.log(`[v${i}] gas used: `, parseInt(receipt.gasUsed, 16).toString());
                console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

                expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it('Should compare v2 with Generic for 100 smallest uint32 id set', async function () {
                const keys = Array.from({ length: 100 }, (_, i) => i);
                const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
                const selector = contract.interface.getFunction("setFeeds").selector;
                const txHash = await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                            [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                    },
                ])

                for (let i = 0; i < keys.length; i++) {
                    const msgData = ethers.solidityPacked(["bytes4"], ['0x' + ((keys[i] | 0x80000000) >>> 0).toString(16).padStart(8, '0')])
                    const res = await network.provider.send("eth_call", [
                        {
                            to: await contract.getAddress(),
                            data: msgData,
                        },
                        "latest",
                    ]);

                    expect(res).to.be.eq(values[i]);
                }

                const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

                const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds(keys, values)).wait();

                console.log(`[v${i}] gas used: `, parseInt(receipt.gasUsed, 16).toString());
                console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

                expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it('Should compare v2 with Generic for 100 biggest uint32 id set', async function () {
                const keys = Array.from({ length: 100 }, (_, i) => i + 2147483548);
                const values = keys.map((key) => ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World ${key}!`), 32)]));
                const selector = contract.interface.getFunction("setFeeds").selector;
                const txHash = await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                            [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
                    },
                ])

                for (let i = 0; i < keys.length; i++) {
                    const msgData = ethers.solidityPacked(["bytes4"], ['0x' + ((keys[i] | 0x80000000) >>> 0).toString(16)])
                    const res = await network.provider.send("eth_call", [
                        {
                            to: await contract.getAddress(),
                            data: msgData,
                        },
                        "latest",
                    ]);

                    expect(res).to.be.eq(values[i]);
                }

                const receipt = await network.provider.send("eth_getTransactionReceipt", [txHash])

                const receiptGeneric = await (await dataFeedStoreGeneric.setFeeds(keys, values)).wait();

                console.log(`[v${i}] gas used: `, parseInt(receipt.gasUsed, 16).toString());
                console.log('[Generic] gas used: ', receiptGeneric?.gasUsed.toString());

                expect(receipt.gasUsed).to.be.lt(receiptGeneric?.gasUsed);
            });

            it('Should test with the biggest possible id', async function () {
                const key = 0x7fffffff;
                const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
                const selector = contract.interface.getFunction("setFeeds").selector;
                await network.provider.send("eth_sendTransaction", [
                    {
                        to: await contract.getAddress(),
                        data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], [selector, key, value]),
                    },
                ]);

                const msgData = ethers.solidityPacked(["bytes4"], ['0xffffffff'])
                const res = await network.provider.send("eth_call", [
                    {
                        to: await contract.getAddress(),
                        data: msgData,
                    },
                    "latest",
                ]);

                expect(res).to.be.eq(value);
            });
        });
    }
});