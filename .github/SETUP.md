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
