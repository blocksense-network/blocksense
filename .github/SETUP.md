# 🛠 Getting Started

1️⃣ **Install** [Nix](https://zero-to-nix.com/start/install) <br>
2️⃣ Install **Direnv** and [hook it](https://direnv.net/docs/hook.html) with your shell <br>
3️⃣ Manually enter the dev shell to accept the suggested Nix substituters:

```sh
nix develop --impure

```

4️⃣ Allow direnv to automatically manage your shell environment

```sh
direnv allow
```

## 🎛️ Customizing Your Dev Environment

By default, you'll enter the **full development shell** with all tools. You can customize which dev shell to use by creating a local `.env` file.

**Available dev shells:**

- `default` - Full development environment (all tools)
- `rust` - Rust-specific development environment
- `js` - JavaScript/TypeScript development environment
- `pre-commit` - Linting and code quality tools (mostly useful for CI jobs)

### Quick Method (Recommended)

Use the `just` command to easily switch between dev shells:

```sh
# Switch to Rust-only environment
just change-devshell rust

# Switch to JavaScript/TypeScript environment
just change-devshell js

# Switch to pre-commit tools only
just change-devshell pre-commit

# Switch back to the full development environment
just change-devshell default
```

The command will automatically create or update your `.env` file and reload direnv for you.

### Manual Method

If you prefer to manage the `.env` file manually, just set the ENV var `DEV_SHELL` within it.

```sh
DEV_SHELL=rust
```

> The change in `.env` will trigger direnv to reload your environment automatically once you enter your terminal.

---

# ⚡ Running the System

## ✅ Supported Deployment Options

Supported deployments can be found under **`blocksense/nix/test-environments`**.

### 🔧 Systemd Deployment

To deploy using **systemd**, follow these steps:

1️⃣ **Add Blocksense as a Flake input**:

github:blocksense-network/blocksense

2️⃣ **Import the Blocksense NixOS module** into the machine where the microservices will be deployed:

```

imports = [
inputs.blocksense.nixosModules.blocksense-systemd
];

```

3️⃣ **Configure services** such as the Sequencer, Reporters, and Anvil nodes using [setup1.nix](/nix/test-environments/example-setup-01.nix)

---

### 🔄 Process-Compose Deployment

1️⃣ Ensure you have a **`process-compose.yaml`** file. Generate it by running:

```

direnv reload

```

2️⃣ The **`process-compose.yaml`** file is **populated from**:

```

nix/test-environments/example-setup-01.nix

```

3️⃣ **Modify `example-setup-01.nix`** to:

- 🟢 Add more reporters
- 🔵 Change the feeds list
- ⚙️ Customize your deployment setup
  Then, **reload the environment**:

```

direnv reload

```

4️⃣ **Start the deployment**:

```

process-compose up

```

✅ The **default example setup** includes:

- 🟢 **1 Sequencer instance**
- 🔵 **2 Anvil nodes**
- 🛠 **Configurable feeds & reporters**

---
