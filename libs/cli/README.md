# Blocksense CLI

**All commands work only inside our blocksense nix shell.**

## Installation

TODO: Currently the CLI is not a cargo package, so you need to build and then use it.

```sh
(cd ../../ && cargo build)
```

## Examples

There is an example configuration in `/test`.

```sh
# Build blocksense node reporter using the blocksense configuration json.
(cd test/ && ../../../target/debug/blocksense node build --from ./test-config.json)

# Provide up as parameter to directly start the runtime.
(cd test/ && ../../../target/debug/blocksense node build --from ./test-config.json --up)

# Use an oracle script template for bootstraping Oracle script development.
../../target/debug/blocksense dev oracle init

# TODO Add commands for using the registry.
```

## CLI Conventions

There are a few conventions that all CLI commands adhere to:

- All subcommands print "short help" with `-h` and "long help" with `--help`.
- Input is by default read from stdin if no file input is specified (when
  applicable).
