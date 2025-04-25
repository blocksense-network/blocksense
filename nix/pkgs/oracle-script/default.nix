{
  lib,
  craneLib,
  pkg-config,
  filesets,
  version ? "dev",
  oracle-path,

  # whether the given oracle script is part of the main workspace
  # or it's standalone
  standalone,
}:
let
  oracle-name = builtins.baseNameOf oracle-path;

  sharedAttrs = rec {
    pname = "oracle-script-${oracle-name}";
    inherit (filesets.rustSrc) src;

    postUnpack = lib.optionalString standalone ''
      cd $sourceRoot/${builtins.toString oracle-path}
      sourceRoot="."
    '';

    cargoToml = ../../.. + oracle-path + /Cargo.toml;

    nativeBuildInputs = [
      pkg-config
    ];

    cargoExtraArgs =
      "--target wasm32-wasip1" + lib.optionalString (!standalone) " --package=${oracle-name}";
    doCheck = false;
    strictDeps = true;
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
