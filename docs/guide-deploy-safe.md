# Safe Contracts Deployment Guide

We use the **Safe Contracts** — `"SimulateTxAccessor"`, `"SafeProxyFactory"`, `"CompatibilityFallbackHandler"`, `"CreateCall"`, `"MultiSend"`, `"MultiSendCallOnly"`, `"SignMessageLib"`, `"Safe"` (plus 5 more we don’t use) — to achieve deterministic deployments, ensuring our contracts are deployed at the same addresses across different networks.

> **Note**: We currently use version **1.4.1** of the Safe contracts.

---

## How to Deploy the Safe Contracts

### Step 1: Check if They Are Already Deployed

- Ideally, check [here](https://github.com/safe-global/safe-singleton-factory/issues).
  Search using the **chainID** in one of the files. (Not everyone updates this repo after deployment. https://github.com/safe-global/safe-deployments/tree/main/src/assets/v1.4.1)
- Alternatively, copy the address from one of the JSON files (e.g., `safe_proxy_factory.json` under `canonical`) and search it in a block explorer for the target network to confirm if it exists as a contract.

---

### Step 2: Start Official Deployment

1. If not deployed, request a deployment by creating a new issue:
   - First, search for existing issues about this network.
2. To create a new issue:
   - The network must already be listed on [chainlist.org](https://chainlist.org/).
   - Copy network details from Chainlist.
   - If the network is not listed, you could try opening a PR to add it. (Note: Chainlist is being deprecated, and merges are rare.)
3. Once you file an issue, a bot will respond with one of three messages:
   1. **Case 1**:
      → Send funds to the provided account and proceed to step 4.
   2. **Case 2**:
      → Deployment is being added; move to step 5.
   3. **Case 3**:
      → Possible explanations:
      1. Deployment was already requested → check other issues for this network → go to step 5.
      2. Safe contracts are already deployed → check as described above → move on with deploying our contracts.
      3. The factory is deployed but the Safe contracts are not (at least for 1.4.1) → go to step 6.
4. Wait for the Safe team to deploy the factory (used to deploy Safe contracts).

5. Wait for a new release that includes this network.
   (This may take more than a month.)
6. Clone the [safe-smart-account](https://github.com/safe-global/safe-smart-account) repo.
7. Checkout the `v1.4.1-3` branch.
8. Add your Node URL and private key to the `.env` file.
9. Ensure `npm` is installed. (Or pull it from another project, e.g. `nix develop ../blocksense`.)
10. Run:
    ```sh
    npm i --save-dev @safe-global/safe-singleton-factory
    ```
11. Run:
    ```sh
    npm run deploy-all custom
    ```
    → You should see deployment logs.
12. Make a PR adding this network as a canonical deployment in [safe-deployments](https://github.com/safe-global/safe-deployments). (For reference: see existing [PR](https://github.com/safe-global/safe-deployments/pull/1097)s.)
13. Safe contracts are now deployed. Proceed to deploy our contracts (see parent page).

---

# Unofficial Safe Contracts Deployment (Using Our Forks)

If you don’t want to wait for the Safe team, or the chain is not added to Chainlist, you can use our forks of the Safe repos.

---

## Steps

1. Clone the **[safe-singleton-factory](https://github.com/safe-global/safe-smart-account) fork**:

   ```sh
   git clone https://github.com/blocksense-network/safe-singleton-factory
   cd safe-singleton-factory
   ```

2. Create a `.env` file and add:

   ```
   PK=<private key of the deployer account>
   RPC=<RPC URL for the network>
   ```

3. Make sure you have `npm` installed.

4. Run:

   ```sh
   npm run estimate-compile
   ```

5. Run:

   ```sh
   npm run submit
   ```

6. Commit and push the new file that was created under `artifacts/<chainid>/deployment.json`:

   ```sh
   git add artifacts/<chainid>/deployment.json
   git commit -m "Add deployment for <chainid>"
   git push
   ```

7. Clone the **safe-smart-account fork**:

   ```sh
   git clone https://github.com/blocksense-network/safe-smart-account
   cd safe-smart-account
   ```

8. Checkout the deployment branch:

   ```sh
   git checkout deploy-v1.4.1-3
   ```

9. Create a `.env` file and add:

   ```
   PK=<private key of the deployer account>
   RPC=<RPC URL for the network>
   ```

10. Install the dependency:

    ```sh
    npm i -D https://github.com/blocksense-network/safe-singleton-factory
    ```

11. Run the deployment:

    ```sh
    npm run deploy-all custom
    ```

12. You should see the contracts being deployed.
    Save the deployed addresses for later.
