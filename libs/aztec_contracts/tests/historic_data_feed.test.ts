import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { AccountWallet, CompleteAddress, ContractDeployer, createPXEClient, Fr, getContractInstanceFromDeployParams, PXE, TxStatus, waitForPXE } from "@aztec/aztec.js";
import { beforeAll, describe, expect, test } from "vitest";
import { HistoricDataFeedStoreContract, HistoricDataFeedStoreContractArtifact } from "../contracts/historic_data_feed_store/src/artifacts/HistoricDataFeedStore.js"

const setupSandbox = async () => {
    const { PXE_URL = "http://localhost:8080" } = process.env;
    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

describe("Data feed store contract", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];


    beforeAll(async () => {
        pxe = await setupSandbox();

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map((w) => w.getCompleteAddress());
    });

    test("If it deploys the contract", async () => {
        const salt = Fr.random();
        const dataFeedStoreContractArtifact = HistoricDataFeedStoreContractArtifact;
        const deployArgs = wallets[0].getCompleteAddress().address;

        const deploymentData = getContractInstanceFromDeployParams(
            dataFeedStoreContractArtifact,
            {
                constructorArgs: [deployArgs],
                salt,
                deployer: wallets[0].getAddress(),
            }
        );

        const deployer = new ContractDeployer(
            dataFeedStoreContractArtifact,
            wallets[0]
        );
        const tx = deployer.deploy(deployArgs).send({ contractAddressSalt: salt });
        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
                error: "",
            })
        );

        const receiptAfterMined = await tx.wait({ wallet: wallets[0] });

        expect(await pxe.getContractInstance(deploymentData.address)).toBeDefined();
        expect(
            await pxe.isContractPubliclyDeployed(deploymentData.address)
        ).toBeDefined();
        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            })
        );

        expect(receiptAfterMined.contract.instance.address).toEqual(
            deploymentData.address
        );
    }, 10000);

    test.only("Sets and get 2 data feeds", async () => {
        let keys = [];
        for (let i = 0; i <= 2; i++) {
            keys.push(new Fr(i));
        }
        let values = [];
        for (let i = 0; i <= 2; i++) {
            const data = Array.from(
                { length: 24 },
                () => Math.floor(Math.random() * 256)
            );
            values.push(...data);
        }
        console.log(values);
        const contract = await HistoricDataFeedStoreContract.deploy(wallets[0])
            .send()
            .deployed();

        console.log(contract.address);

        await contract
            .withWallet(wallets[0])
            .methods.set_feeds(keys, values, 2)
            .send()
            .wait();
        const get_feed_tx = await contract.methods.get_data_feed(keys[0]).simulate();
        const _get_feed_tx = await contract.methods.get_data_feed(keys[1]).simulate();
        const __get_feed_tx = await contract.methods.get_data_feed(keys[2]).simulate();
        console.log(get_feed_tx)
        console.log(_get_feed_tx)
        console.log(__get_feed_tx)
    }, 30000);
});