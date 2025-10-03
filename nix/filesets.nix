{ lib, ... }:
let
  root = ../.;

  cargoFiles = [
    "Cargo.toml"
    "Cargo.lock"
  ];
in
with lib.fileset;
{
  inherit (lib.fileset) trace;

  nodeSoftwareSrc = rec {
    fileset =
      let
        oracleRelated = unions [
          (lib.path.append root "apps/oracles")
          (difference (lib.path.append root "libs/sdk") (lib.path.append root "libs/sdk/wit"))
        ];
      in
      difference (unions [
        (lib.path.append root ".cargo/config.toml")

        (fileFilter (
          file:
          builtins.elem file.name (cargoFiles ++ [ "deps.toml" ])
          || builtins.any file.hasExt [
            "rs"
            "wit"
          ]
        ) root)

        # JSON files must be listed one by one, otherwise changing an
        # unrelated JSON file will cause all Rust derivations to be rebuilt
        (lib.path.append root "apps/sequencer_tests/Safe.json")
        (lib.path.append root "apps/sequencer_tests/SafeProxyFactory.json")
        (lib.path.append root "libs/gnosis_safe/safe_abi.json")
      ]) oracleRelated;
    src = toSource { inherit root fileset; };
  };

  oracleSrc = rec {
    fileset = unions [
      (lib.path.append root "libs/sdk")

      (fileFilter (
        file:
        builtins.elem file.name cargoFiles
        || builtins.any file.hasExt [
          "rs"
          "json"
        ]
      ) (lib.path.append root "apps/oracles"))
    ];
    src = toSource { inherit root fileset; };
  };
}
