# Initial Feeds Config

## Purpose

The `initial-feeds-config` module is responsible for generating the initial data feed configuration for Blocksense. As a competitor to Chainlink and a potential drop-in replacement, this module collects raw data from Chainlink and transforms it to meet the needs of Blocksense.

## Deprecation Notice

**Deprecated**: This module is now deprecated and should no longer be used. The initial feed configuration work has been completed, and from this point onward, only new feeds should be added or existing ones updated in the feed config.

## Detailed Description

The `apps/data-feeds-config-generator/scripts/generate-initial-feeds-config.ts` script orchestrates the entire process of generating the initial feeds configuration. Below is a step-by-step breakdown of the process:

1. **Collect Raw Data from Chainlink**:

   - Gather all public information about Chainlink data feeds.

2. **Process Raw Data**:

   - **Aggregate Network Information**: Process Chainlink’s raw data into a more suitable format for further processing.
   - **Remove Specific Feeds**: Exclude irrelevant or unsupported feeds.
   - **Transform Raw Data into a Semi-Final Blocksense Format**: Extract only the necessary information and convert it into a semi-final Blocksense config format that can be further processed.

3. **Generate Feed Configuration**:

   - The `generateFeedConfig` function is at the heart of the script. It processes the collected raw data, applies necessary transformations, and outputs the final configuration in a format compatible with Blocksense.

   Key steps in the function include:

   - **Get Chainlink Feeds on Mainnet**: Collect data from Chainlink’s mainnet feeds.
   - **Get Unique Data Feeds**: Filter out duplicates.
   - **Remove Unsupported Feed Types**: Exclude feed types that are not supported by Blocksense.
   - **Remove Non-Crypto Feeds**: Filter out feeds unrelated to cryptocurrencies.
   - **Add Stablecoin Variants**: Ensure that stablecoin variants are included in the configuration.
   - **Add Providers Data**: The `addDataProviders` function adds provider data to the feeds, filtering out any feeds without providers.
   - **Check On-Chain Data**: Verify on-chain data where necessary.
   - **Add Market Cap Rank**: Include market cap ranking for the feeds.
   - **Sort Feeds**: The `sortFeedsConfig` function organizes the feeds by rank and other criteria.
   - **Construct Final Feeds Config**: Map the sorted feeds to the required format and generate the final configuration.

4. **Save the Generated Configuration**:
   - The final configuration is saved to `apps/data-feeds-config-generator/config`, making it available for use by the Blocksense system.
