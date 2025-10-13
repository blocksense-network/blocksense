{ lib, ... }:
let
  inherit (lib.fileset)
    unions
    difference
    fileFilter
    toSource
    ;

  # This module defines two filesets/sources:
  # - nodeSoftwareSrc: inputs that should trigger node (Rust) rebuilds
  # - oracleSrc: inputs specific to oracle apps
  # It also codifies exclusions to avoid unnecessary rebuilds.

  root = ../.; # Repo root; update if this file moves

  # Cargo manifest files. Keep in sync with the fileFilter below, which also
  # includes "deps.toml" (tracked outside Cargo but relevant to Rust builds).
  cargoFiles = [
    "Cargo.toml"
    "Cargo.lock"
  ];
in
{
  nodeSoftwareSrc = rec {
    src = toSource { inherit root fileset; };
    fileset =
      let
        # Files considered "oracle-related": changes here SHOULD NOT rebuild
        # the node. Note: trigger-oracle only needs libs/sdk/wit; everything
        # else under libs/sdk is excluded from node builds to keep Rust
        # rebuilds minimal.
        oracleRelated = unions [
          (lib.path.append root "apps/oracles")
          (difference (lib.path.append root "libs/sdk") (lib.path.append root "libs/sdk/wit"))
        ];
      in
      # Start from everything relevant to node, then subtract oracle-related changes.
      difference (unions [
        # Cargo config can affect compilation (target, features, linker args,
        # etc.), so include it explicitly.
        (lib.path.append root ".cargo/config.toml")

        # Rebuild node software when:
        # - Cargo manifests or deps.toml change, or
        # - Any Rust (*.rs) or WIT (*.wit) files under the repo change.
        (fileFilter (
          file:
          builtins.elem file.name (cargoFiles ++ [ "deps.toml" ])
          || builtins.any file.hasExt [
            "rs"
            "wit"
          ]
        ) root)

        # IMPORTANT: JSON files are allowlisted to avoid false rebuilds.
        # If you add a JSON the Rust build depends on, list it here explicitly.
        (lib.path.append root "apps/sequencer_tests/Safe.json")
        (lib.path.append root "apps/sequencer_tests/SafeProxyFactory.json")
        (lib.path.append root "libs/gnosis_safe/safe_abi.json")
      ]) oracleRelated;

  };

  oracleSrc = rec {
    src = toSource { inherit root fileset; };
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
  };
}
