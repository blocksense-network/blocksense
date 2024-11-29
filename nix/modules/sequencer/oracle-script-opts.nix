{ lib, ... }:
with lib;
{
  options = {
    path = mkOption {
      type = types.path;
      description = mdDoc "Path to the oracle script.";
    };

    build-command = mkOption {
      type = types.str;
      description = mdDoc "Command for building the oracle scripts to wasm.";
      default = "cargo build --target wasm32-wasip1 --release";
    };

    source = mkOption {
      type = types.path;
      description = mdDoc "Path to the wasm target.";
    };
  };
}
