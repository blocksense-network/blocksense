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

    it('Should be able to set v1 data feed', async function () {
        const key = 0;
        const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
        await dataFeedStoreV1.setFeedById(key, value);

        const msgData = ethers.solidityPacked(["bytes4"], ["0x00000000"])
        const res = await network.provider.send("eth_call", [
            {
                to: await dataFeedStoreV1.getAddress(),
                data: msgData,
            },
            "latest",
        ]);

        expect(res).to.be.eq(value);
    });

    it('Should compare v1 with basic', async function () {
        const key = 0;
        const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
        await dataFeedStoreV1.setFeedById(key, value);
        const estimatedGas = await dataFeedStoreV1.setFeedById.estimateGas(key, value);

        const msgData = ethers.solidityPacked(["bytes4"], ["0x00000000"])
        const res = await network.provider.send("eth_call", [
            {
                to: await dataFeedStoreV1.getAddress(),
                data: msgData,
            },
            "latest",
        ]);

        expect(res).to.be.eq(value);

        const estimatedGasBasic = await dataFeedStoreBasic.setFeedById.estimateGas(key, value);

        expect(estimatedGas).to.be.lt(estimatedGasBasic);

        console.log('estimatedGas', estimatedGas);
        console.log('estimatedGasBasic', estimatedGasBasic);

        console.log('-------------------');

        await dataFeedStoreV1.setFeedById(1, value);
        await dataFeedStoreBasic.setFeedById(1, value);
    });

    it('Should be able to set v2 data feed', async function () {
        const key = 3;
        const value = ethers.solidityPacked(["bytes32"], [ethers.zeroPadBytes(ethers.toUtf8Bytes("Hello, World!"), 32)]);
        await network.provider.send("eth_sendTransaction", [
            {
                to: await dataFeedStoreV2.getAddress(),
                data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], ["0x3179a67f", key, value]),
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
        await network.provider.send("eth_sendTransaction", [
            {
                to: await dataFeedStoreV2.getAddress(),
                data: ethers.solidityPacked(["bytes4", "uint32", "bytes32"], ["0x3179a67f", key, value]),
            },
        ]);
        const estimatedGas = await dataFeedStoreV2.setFeedById.estimateGas(key, value);

        const msgData = ethers.solidityPacked(["bytes4"], ["0x80000003"])
        const res = await network.provider.send("eth_call", [
            {
                to: await dataFeedStoreV2.getAddress(),
                data: msgData,
            },
            "latest",
        ]);

        expect(res).to.be.eq(value);

        const estimatedGasBasic = await dataFeedStoreBasic.setFeedById.estimateGas(key, value);

        expect(estimatedGas).to.be.lt(estimatedGasBasic);

        console.log('estimatedGas', estimatedGas);
        console.log('estimatedGasBasic', estimatedGasBasic);

        console.log('-------------------');

        await dataFeedStoreV2.setFeedById(1, value);
        await dataFeedStoreBasic.setFeedById(1, value);
    });
});