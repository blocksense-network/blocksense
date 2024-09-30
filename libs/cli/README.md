# Blocksense CLI

**All commands work only inside our blocksense nix shell.**

## Installation

TODO: The CLI depends on spin and cargo being installed.

## Examples

There is an example configuration in `/test`.
Please copy the `.wasm` files from the sdk examples folder to `/test`

```sh
# Build blocksense node reporter using the blocksense configuration json.
cargo run --bin blocksense node build --from ./test-config.json

# Build blocksense node reporter using the blocksense configuration folder.
# You can also provide up as parameter to directly start the runtime.
# *The first json in the directory is treated as the configuration*
cargo run --bin blocksense node build --from ./test --up

# Use an oracle script template for bootstraping Oracle script development.
cargo run --bin blocksense dev oracle init

# TODO Add commands for using the registry.
```

## CLI Conventions

There are a few conventions that all CLI commands adhere to:

- All subcommands print "short help" with `-h` and "long help" with `--help`.
- Input is by default read from stdin if no file input is specified (when
  applicable).
