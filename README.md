<table align="center">
  <tr>
    <td valign="top">
      <h1>Blocksense Network <code>monorepo</code></h1>
      <pre>The ZK rollup for scaling oracle data to infinity.</pre>
    </td>
    <td valign="center">
      <img src="./docs/assets/img/blocksense-logo.jpg" align="center" width="120">
    </td>
  </tr>
</table>

---

<!-- ## Table of Contents -->

## Contributing

### Getting started

1. [Install](https://zero-to-nix.com/start/install) Nix
2. Install Direnv and [hook it](https://direnv.net/docs/hook.html) with your shell
3. Manually enter the dev shell to accept the suggested Nix substituters:
   ```
   nix develop --impure
   do you want to [..] (y/N)? # answer "y" to all questions like this
   ```
4. Allow direnv to automatically manage your shell environment
   ```sh
   direnv allow
   ```

[blocksnse-logo]: ./docs/assets/img/blocksense-logo.jpg

---

## Running the system

### Supported deployment options

Supported deployments can be found under blocksense/nix/test-environments

#### systemd deployment

In order to perform a systemd deployment one needs to:

1. Add as flake input `github:blocksense-network/blocksense`
2. In the configuration of the machine, where the blocksense micro services will be deployed, the blocksense NixOS module must be imported:

```
imports = [
   inputs.blocksense.nixosModules.blocksense-systemd
];
```

3. To configure the sequencer, the reporters and the anvil nodes one can use the [setup1.nix](/nix/test-environments/setup1.nix) file.

#### process-compose deployment

First, make sure you have a `process-compose.yaml` file that can be generated
by executing command:

```sh
direnv reload
```

the contents of `process-compose.yaml` are populated from the file
`nix/test-environments/example-setup-01.nix`. To change the setup (add more
reporters, change the feeds list etc) edit `example-setup-01.nix` and then run
`direnv reload` again.

The example setup is with 1 instance of the sequencer, 2 anvil nodes is
supported.

To perform this deployment, we need to run:

```sh
process-compose up
```

For more information, see [Blocksense Network Documentation Site](/apps/docs.blocksense.network/README.md)
