# Deploy Blocksense Oracle on Aurora Virtual Chains

This guide is designed for **Aurora bootcamp participants** who want to deploy Blocksense as an oracle solution on their Aurora virtual chains. At this point, we assume you have already defined your data feeds and developed an oracle. Now let's deploy these feeds on your Aurora virtual network, secured by Blocksense.

## Prerequisites

Before starting, ensure you have:

- ✅ **Two funded accounts** on your Aurora virtual chain
- ✅ **RPC endpoint** for your Aurora virtual chain
- ✅ **Chain ID** of your Aurora virtual chain
- ✅ **Network name** (descriptive name for your chain)
- ✅ **Data feeds configuration** ready
- ✅ **Blocksense development environment** set up

## Step 1: Introduce Your Network

Run the network introduction command to configure your Aurora virtual chain:

```bash
just introduce-network
```

This interactive command will prompt you with several questions. Here's what each prompt means and how to answer:

### Network Configuration Prompts

**1. Network Name**

```
What is the network name? (e.g., Ethereum, Polygon, BSC) chicken-farm
```

- **Purpose**: A descriptive identifier for your Aurora virtual chain
- **Example**: `chicken-farm`, `my-aurora-chain`, `bootcamp-network`
- **Note**: Use kebab-case (lowercase with hyphens)

**2. Network ID (Chain ID)**

```
What is the network ID? (e.g., 1, 137, 56) 1325
✓ Valid network ID: 1325
```

- **Purpose**: The unique chain identifier for your Aurora virtual chain
- **Example**: `1325` (your specific Aurora chain ID)
- **Validation**: Must be a positive integer

**3. Network RPC URL**

```
What is the network RPC URL? (e.g., https://mainnet.infura.io/v3/...) http://127.0.0.1:5555
✓ Valid RPC URL
```

- **Purpose**: The endpoint to connect to your Aurora virtual chain
- **Example**: `https://your-aurora-chain.rpc.endpoint`, `http://127.0.0.1:5555` (for local development)
- **Validation**: Must be a valid HTTP/HTTPS URL

**4. Deployer Address**

```
What is the deployer address? (This should be unique for deployment operations)
✓ Valid deployer address
```

- **Purpose**: The Ethereum address that will deploy and manage contracts
- **Requirements**:
  - Must be funded with native tokens for gas fees
  - Should have deployment and administrative privileges
  - Must be different from the sequencer address

**5. Deployer Private Key**

```
What is the deployer private key? (Keep this secure and different from other keys)
✓ Admin multisig owner set to deployer address
```

- **Purpose**: Private key corresponding to the deployer address
- **Format**: Hexadecimal string starting with `0x`

**6. Sequencer Address**

```
What is the sequencer address? (Must be different from deployer)
```

- **Purpose**: The address that will sequence and submit oracle data
- **Requirements**:
  - Must be funded with native tokens for ongoing operations
  - Must be different from the deployer address
  - Will be responsible for data feed updates

### What Happens Next

After completing all prompts, the system will:

1. **Update Environment Variables**: Your `.env` file will be updated with network-specific configurations
2. **Generate Network Config**: A JSON configuration file will be created for your network
3. **Update Network Registry**: Your network will be added to the internal network registry

You can examine the updated `.env` file and the generated config file in `libs/ts/base-utils/src/evm/additional-networks.json`.

## Step 2: Deploy Oracle Contracts

Once your network is configured, deploy the Blocksense oracle contracts:

```bash
just deploy-to-network [your-network-name]
```

Replace `[your-network-name]` with the network name you specified in Step 1.

At this point, you will be able to examine the deployment settings and confirm deployment.

This command will:

- Deploy core Blocksense contracts to your Aurora virtual chain
- Set up access control and permissions
- Configure data feed adapters
- Establish multisig governance structures

### Expected Deployment Output

You should see output similar to:

```
Blocksense EVM contracts deployment
===================================

// RPC: http://127.0.0.1:5555
// Network: chicken-farm (chainId: 1325)
// Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
// Balance: 10000.0 ETH
// Admin MultiSig: ✅
//   threshold: 1
//      owners: [...]

Predicted address for 'AccessControl': 0x...
Predicted address for 'ADFS': 0x...
Predicted address for 'UpgradeableProxyADFS': 0x...
...
```

## Step 3: Start Blocksense Oracle Service

After successful contract deployment, start the Blocksense oracle service:

```bash
just start-blocksense
```

This command will:

- Commit the deployment configuration to git ( this is nix specific )
- Start the Blocksense environment
- Begin data feed aggregation and submission to your Aurora virtual chain

## Verification Steps

### 1. Check Contract Deployment

Verify your contracts are deployed by checking the generated deployment configuration:

```bash
cat config/evm_contracts_deployment_v2/[your-network-name].json
```

This file contains all deployed contract addresses and configuration details.

### 2. Monitor Oracle Activity

Once running, monitor oracle activity through:

- **Logs**: Check the Blocksense service logs for data feed updates. Navigate to `logs/process-compose/example-setup-04/` for detailed logs.
- **On-chain**: Verify transactions are being submitted to your Aurora virtual chain
- **Explorer**: Use your Aurora chain explorer to view oracle transactions
- **Local Monitoring Tools**: Use tools like `cast` to check feeds state. For example, you can use `cast` to query the latest data on any of the deployed CL adapters ( address can be found in the deployment config mentioned above ):

```bash
cast call 0xf4c85bEdbcf30b7644fA2edAB23B6C76ca90b80e "latestAn
swer()" --rpc-url http://127.0.0.1:5555 | cast to-dec
```

## Troubleshooting

### Common Issues

**1. RPC Connection Errors**

```
Error: Failed to connect to network
```

- Verify your RPC URL is accessible
- Check if your Aurora virtual chain is running
- Ensure network connectivity

**2. Insufficient Funds**

```
Error: Insufficient funds for gas
```

- Fund your deployer and sequencer addresses
- Check gas price settings for your Aurora chain

**3. Chain ID Mismatch**

```
Error: Chain ID mismatch
```

- Verify the chain ID matches your Aurora virtual chain
- Check Aurora chain configuration

**4. Permission Errors**

```
Error: Access denied
```

- Verify deployer address has necessary permissions
- Check private key corresponds to deployer address

**5. Missing Safe Contracts**

```
Error: Safe contract not found at address
Error: Failed to initialize Safe multisig
Error: Contract creation failed
```

- **Issue**: Safe (formerly Gnosis Safe) contracts may not be deployed on your Aurora virtual chain
- **Solution**: Safe contracts need to be pre-deployed on the network for Blocksense multisig functionality
- **Check**: Verify if Safe contracts are available at the expected addresses for your chain
- **Alternative**: For development/testing, you can temporarily disable multisig features by adjusting the configuration
- **Resources**: Consult [Safe contract deployments](https://github.com/safe-global/safe-deployments) for standard addresses or deploy Safe contracts to your Aurora virtual chain
- **Note**: If you choose to deploy Safe contracts yourself, you can read our [guide on deploying Safe contracts](./guide-deploy-safe.md)

## Next Steps

After successfully deploying Blocksense on your Aurora virtual chain:

1. **Configure Data Feeds**: Set up your specific data feed requirements
2. **Monitor Performance**: Track oracle reliability and data accuracy
3. **Scale Operations**: Add additional data sources or feed types
4. **Integrate Applications**: Connect your dApps to the deployed oracle contracts

Your Aurora virtual chain is now secured by Blocksense oracle infrastructure! 🎉
