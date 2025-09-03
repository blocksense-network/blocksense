# Developing Custom Oracles for Blocksense

This guide will walk you through creating custom oracle components. Oracles are the data collection engines that fetch information from external sources and feed it into the Blocksense aggregation system.

## Oracle Architecture Overview

### Reporter Software

The **reporter software** is the orchestration layer that manages multiple oracle components. It's responsible for:

- Loading and executing oracle WebAssembly (WASM) components
- Managing execution intervals and scheduling
- Handling API credentials and outbound networking permissions
- Communicating with the Blocksense sequencer

### Oracle Components

**Oracle components** are individual data collectors written in **Rust** and compiled to **WebAssembly (WASM)**. Each oracle:

- Fetches data from specific external APIs or sources
- Processes and validates the collected data
- Returns structured data feeds to the reporter
- Runs in a sandboxed WASM environment for security

### Spin Framework

We use [**Fermyon Spin**](https://www.fermyon.com/spin) as our WASM runtime, which provides:

- WebAssembly execution environment
- HTTP client capabilities for API calls
- Component scheduling and lifecycle management
- Security sandboxing for untrusted code execution

## Getting Started: Copy an Existing Oracle

The fastest way to create a new oracle is to copy an existing simple one. We recommend starting with the **`chicken-farm`** oracle as it's deliberately simple and well-commented.

### Step 1: Create Your Oracle Branch

Create a feature branch for your oracle development:

```fish
git checkout -b feature/my-custom-oracle
```

### Step 2: Copy the Chicken Farm Oracle

Copy the entire `chicken-farm` oracle directory:

### Step 3: Update Cargo.toml

Edit the `Cargo.toml` file in your new oracle directory:

```toml
[package]
name = "my_custom_oracle"  # Update this
version = "0.1.0"
edition = "2021"

[dependencies]
# Keep existing dependencies
blocksense-sdk = { workspace = true }
anyhow = { workspace = true }
serde = { workspace = true, features = ["derive"] }
serde_json = { workspace = true }
tracing = "0.1"
tracing-subscriber = "0.3"

[lib]
crate-type = ["cdylib"]
```

### Step 4: Add Your Oracle to the Workspace

Edit `apps/oracles/Cargo.toml` to include your new oracle in the workspace:

```toml
[workspace]
members = [
  "cex-price-feeds",
  "exsat-holdings",
  "gecko-terminal",
  "eth-rpc",
  "borrow-rates",
  "stock-price-feeds",
  "forex-price-feeds",
  "spout-rwa",
  "chicken-farm",
  "my-custom-oracle",  # Add this line
]
# ...rest of file
```

## Step 5: Develop Your Oracle Logic

Edit `src/lib.rs` to implement your custom data collection logic:
You might like to use some of our SDK utils. See [blocksense-sdk](https://github.com/blocksense-network/blocksense/tree/main/libs/sdk) and [blocksense-data-providers-sdk](https://github.com/blocksense-network/blocksense/tree/main/libs/data_providers_sdk)

## Step 6: Configure Your Oracle in spin.toml

The `spin.toml` file configures how your oracle runs. Here's an annotated example:

```toml
spin_manifest_version = 2

[application]
authors = ["Your Name"]
name = "My Custom Oracle"
version = "0.1.0"

# This is for the local setup, no need to change it
[application.trigger.settings]
interval_time_in_seconds = 10
sequencer = "http://127.0.0.1:9856/post_reports_batch"
secret_key = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003"
second_consensus_secret_key = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003"
kafka_endpoint = "http://127.0.0.1:9092"
reporter_id = 0

[[trigger.oracle]]
component = "my-custom-oracle"

# Define your data feeds
[[trigger.oracle.data_feeds]]
id = "3000000"  # Unique feed ID
stride = 0
decimals = 6    # Number of decimal places
data = '{"pair":{"base":"BTC","quote":"USD"},"decimals":6,"category":"Crypto","market_hours":"24/7","arguments":{}}'

[[trigger.oracle.data_feeds]]
id = "3000001"
stride = 0
decimals = 6
data = '{"pair":{"base":"ETH","quote":"USD"},"decimals":6,"category":"Crypto","market_hours":"24/7","arguments":{}}'

[component.my-custom-oracle]
source = "../target/wasm32-wasip1/release/my_custom_oracle.wasm"

# 🔑 CRITICAL: Allowed outbound hosts
allowed_outbound_hosts = [
  "https://api.example.com",        # Your API endpoints
  "https://api.backup-source.com", # Backup data sources
  "https://auth.provider.com",      # Authentication endpoints
]

# 🔧 Build configuration
[component.my-custom-oracle.build]
command = "cargo build --target wasm32-wasip1 --release"

# 🔐 API Keys and Credentials
[[trigger.oracle.capabilities]]
data = "YOUR_API_KEY_HERE"
id = "EXAMPLE_API_KEY"

[[trigger.oracle.capabilities]]
data = "your-secret-token"
id = "AUTH_TOKEN"
```

### Key Configuration Sections

#### 🌐 `allowed_outbound_hosts`

This is **critical** for security - only URLs listed here can be accessed by your oracle:

- Include all API endpoints your oracle needs to call
- Use HTTPS URLs when possible

#### 🔐 `trigger.oracle.capabilities`

These are your API keys and credentials:

- Store sensitive data like API keys, tokens, auth headers
- Access them in your Rust code via the settings
- **Never** commit real API keys to git - use placeholder values

#### 📊 `trigger.oracle.data_feeds`

Define what data your oracle provides:

- `id`: Unique identifier for this feed
- `decimals`: How many decimal places for precision
- `data`: JSON configuration passed to your oracle

## Step 7: Include Oracle in Nix Environment

To use your oracle in the Blocksense development environment, add it to a nix configuration file.

For example, in `nix/test-environments/example-setup-01.nix`:

```nix
{
  # ...existing configuration...

  services.blocksense = {
    # ...existing settings...

    oracles = {
      ...,
      my-custom-oracle = {
        exec-interval = 10;
        allowed-outbound-hosts = [
          "https://auth.provider.com"
        ];
      };
    };
  };
}
```

## Step 8: Build and Test Your Oracle

### Build the Oracle

```fish
just build-oracle my-custom-oracle
```

### Run the Oracle in Isolation

```fish
just start-oracle my-custom-oracle
```

### Test in Full Environment

```fish
# Start the complete Blocksense environment
just start-environment example-setup-03
```

Monitor your oracle's logs:

```fish
tail -f logs/process-compose/example-setup-03/reporter-a.log
```

## Troubleshooting

### Common WASM Limitations

WebAssembly has some restrictions you need to be aware of:

**🚫 File System Access**

```rust
// ❌ This won't work
let contents = std::fs::read_to_string("config.txt")?;

// ✅ Use configuration passed via spin.toml instead
let config = get_resources_from_settings(&settings)?;
```

**🚫 Threading**

```rust
// ❌ This won't work
let handle = std::thread::spawn(|| { /* work */ });

// ✅ Use async/await instead
async fn fetch_data() -> Result<Data> {
    // async work
}
```

**🚫 System Calls**

```rust
// ❌ This won't work
let output = std::process::Command::new("curl").output()?;

// ✅ Use the provided HTTP client
let response = http_get_json("https://api.example.com/data").await?;
```

**🚫 Network Access Outside allowed_outbound_hosts**

```rust
// ❌ This will fail if not in allowed_outbound_hosts
let data = http_get_json("https://random-api.com/data").await?;

// ✅ Ensure the URL is in your spin.toml allowed_outbound_hosts list
```

### Oracle Not Running

**Check Nix Configuration**

- Ensure your oracle is added to the environment's oracle list
- Verify the execution interval is set

**Check Logs**

```fish
# Check reporter logs
tail -f logs/process-compose/example-setup-03/reporter-a.log

# Check sequencer logs
tail -f logs/process-compose/example-setup-03/sequencer.log
```

**Rebuild Environment**

```fish
# Rebuild the entire environment
just build-environment example-setup-03
just start-environment example-setup-03
```

### Pro tip

Follow commits of `feat/init-chicken-farm` branch in the main repo to see how we built the chicken-farm oracle from scratch.
