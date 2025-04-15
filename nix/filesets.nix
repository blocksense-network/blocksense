{ lib, ... }:
let
  root = ../.;
in
with lib.fileset;
{
  inherit (lib.fileset) trace;

  rustSrc = rec {
    fileset = unions [
      (root + "/Cargo.toml")
      (root + "/Cargo.lock")

      (fileFilter (
        file:
        builtins.any file.hasExt [
          "rs"
          "toml"
          "wit"
        ]
      ) root)

      # JSON files must be listed one by one, otherwise changing an
      # unrelated JSON file will cause all Rust derivations to be rebuilt
      (root + "/apps/sequencer_tests/Safe.json")
      (root + "/apps/oracles/eth-rpc/src/abi/YnETHx.json")
      (root + "/apps/sequencer_tests/SafeProxyFactory.json")
      (root + "/libs/gnosis_safe/safe_abi.json")
      (root + "/apps/oracles/eth-rpc/src/abi/YnETHx.json")
    ];
    src = toSource { inherit root fileset; };
  };
}
