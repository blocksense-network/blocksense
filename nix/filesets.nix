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

      # JSON files
      (root + "/apps/sequencer_tests/Safe.json")
      (root + "/apps/sequencer_tests/SafeProxyFactory.json")
      (root + "/libs/gnosis_safe/safe_abi.json")
    ];
    src = toSource { inherit root fileset; };
  };
}
