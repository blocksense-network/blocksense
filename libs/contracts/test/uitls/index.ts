import { ethers } from "ethers";
import { network } from "hardhat";
import { IDataFeedStore, IDataFeedStoreGeneric, IDataFeedStoreGenericV2 } from "../../typechain";

export const getter = async (contract: IDataFeedStore, selector: string) => {
    const msgData = ethers.solidityPacked(["bytes4"], [selector])
    return network.provider.send("eth_call", [
        {
            to: await contract.getAddress(),
            data: msgData,
        },
        "latest",
    ]);
}

export const setter = async (contract: IDataFeedStore, selector: string, keys: number[], values: string[]) => {
    const txHash = await network.provider.send("eth_sendTransaction", [
        {
            to: await contract.getAddress(),
            data: ethers.solidityPacked(["bytes4", ...keys.map(() => ["uint32", "bytes32"]).flat()],
                [selector, ...keys.flatMap((key, i) => [key, values[i]])]),
        },
    ]);

    return network.provider.send("eth_getTransactionReceipt", [txHash]);
}

export const getV1Selector = (key: number): string => {
    return '0x' + (key >>> 0).toString(16).padStart(8, '0')
}


export const getV2Selector = (key: number): string => {
    return '0x' + ((key | 0x80000000) >>> 0).toString(16).padStart(8, '0');
}

export const compareGasUsed = async (genericContract: IDataFeedStoreGeneric | IDataFeedStoreGenericV2, contracts: IDataFeedStore[], selector: string, valuesCount: number, start: number = 0) => {
    const keys = Array.from({ length: valuesCount }, (_, i) => i + start);
    const values = Array.from({ length: valuesCount }, (_, i) => ethers.zeroPadBytes(ethers.toUtf8Bytes(`Hello, World! ${i}`), 32));

    const receipts = [];
    for (const contract of contracts) {
        receipts.push(await setter(contract, selector, keys, values));
    }

    let receiptGenericPromise;
    if (isGenericV1(genericContract)) {
        receiptGenericPromise = await genericContract.setFeeds(keys, values);
    } else {
        receiptGenericPromise = await genericContract.setFeeds(
            ethers.solidityPacked(keys.map(() => ["uint32", "bytes32"]).flat(), keys.flatMap((key, i) => [key, values[i]]))
        );
    }

    const receiptGeneric = await receiptGenericPromise.wait();

    for (const [index, receipt] of receipts.entries()) {
        console.log(`[${index + 1}] gas used: `, Number(receipt?.gasUsed));
    }
    console.log('[Generic] gas used: ', Number(receiptGeneric?.gasUsed));

    return { receipts, receiptGeneric }
}

function isGenericV1(contract: IDataFeedStoreGeneric | IDataFeedStoreGenericV2): contract is IDataFeedStoreGeneric {
    return (contract as IDataFeedStoreGeneric).interface.getFunction('setFeeds').inputs.length === 2;
}