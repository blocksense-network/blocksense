{
  lib,
  craneLib,
  pkg-config,
  libusb1,
  git,
  openssl,
  rdkafka,
  libgcc,
  zstd,
  stdenv,
  darwin,
  iconv,
  curl,
  filesets,
  autoPatchelfHook,
  writeTextFile,
  version ? "dev",
}:
let
  root = ../../..;
  # src = craneLib.cleanCargoSource root;

  # localDepsFileSetForCrate = crate-path:{}

  fileSetForCrate =
    crate-path:
    lib.fileset.toSource {
      inherit root;
      fileset = lib.fileset.unions (
        [
          (root + /Cargo.toml)
          (root + /Cargo.lock)
          (craneLib.fileset.commonCargoSources crate-path)
        ]
        ++ (builtins.attrValues (resolveTransitiveLocalDependencies crate-path))
      );
    };

  fileSetForCrateWithDeps =
    crate-path:
    lib.fileset.toSource {
      root = crate-path;
      fileset = lib.fileset.unions [
        (craneLib.fileset.commonCargoSources crate-path)
      ];
    };

  resolvePackageNameByPath =
    crate-path:
    let
      cargo-toml = craneLib.cleanCargoToml { cargoToml = "${crate-path}/Cargo.toml"; };
    in
    cargo-toml.package.name;

  resolveTransitiveLocalDependencies =
    crate-path:
    let
      direct-dependencies = resolveLocalDependencies crate-path;
      direct-dependency-paths = builtins.attrValues direct-dependencies;
      dependencies-of-direct-dependencies = builtins.map resolveLocalDependencies direct-dependency-paths;
    in
    direct-dependencies // (lib.mergeAttrsList dependencies-of-direct-dependencies);

  # Resolve local dependency paths for crate
  # TODO: Handle workspace.dependencies ({ workspace = true })
  resolveLocalDependencies =
    crate-path:
    let
      cargo-toml = craneLib.cleanCargoToml { cargoToml = "${crate-path}/Cargo.toml"; };

      local-dependencies = lib.filterAttrs (
        key: value: builtins.isAttrs value && builtins.hasAttr "path" value
      ) cargo-toml.dependencies;

      local-dependencies-resolved-aliases = lib.mapAttrs' (
        name:
        { path, ... }:
        let
          absolute-path = crate-path + "/${path}";
        in
        lib.nameValuePair (resolvePackageNameByPath absolute-path) absolute-path
      ) local-dependencies;
    in
    local-dependencies-resolved-aliases;

  common-attrs = {
    inherit (filesets.rustSrc) src;

    nativeBuildInputs =
      [
        git
        pkg-config
      ]
      ++ lib.optionals stdenv.isLinux [ autoPatchelfHook ]
      ++ lib.optionals stdenv.isDarwin [
        # Needed by https://github.com/a1ien/rusb/blob/v0.7.0-libusb1-sys/libusb1-sys/build.rs#L27
        darwin.DarwinTools
      ];

    buildInputs =
      [
        # Neeeded by alloy-signer-{ledger,trezor,wallet}
        libusb1
        openssl
        zstd
        rdkafka
      ]
      ++ lib.optionals stdenv.isDarwin [
        iconv

        darwin.apple_sdk.frameworks.Security
        darwin.apple_sdk.frameworks.AppKit

        # Used by ggml / llama.cpp
        darwin.apple_sdk.frameworks.Accelerate

        curl
      ];

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    doInstallCargoArtifacts = true;

    doCheck = false; # TODO: Figure out why it's failing with doCheck
    strictDeps = true;
  };

  packageWorkspaceMembers =
    let
      cargo-toml = craneLib.cleanCargoToml { cargoToml = "${root}/Cargo.toml"; };

      derivationFromCratePath =
        crate-path:
        let
          absolute-path = "${root}/${crate-path}";
        in
        rec {
          name = resolvePackageNameByPath absolute-path;
          value = craneLib.buildPackage (
            common-attrs
            // {
              pname = name;
              cargoExtraArgs = "-p ${name}";
            }
          );
        };
      result = builtins.listToAttrs (builtins.map derivationFromCratePath cargo-toml.workspace.members);
    in
    result;
  # builtins.map (member: derivationFromCratePath member) cargo-toml.workspace.members;
  # builtins.map (member: builtins.isPath ("${root}/${member}")) cargo-toml.workspace.members;
  # builtins.map (member: builtins.isPath (root + "/${member}")) cargo-toml.workspace.members;

  sharedAttrs = {
    pname = "blocksense";
    inherit (filesets.rustSrc) src;

    nativeBuildInputs =
      [
        git
        pkg-config
      ]
      ++ lib.optionals stdenv.isLinux [ autoPatchelfHook ]
      ++ lib.optionals stdenv.isDarwin [
        # Needed by https://github.com/a1ien/rusb/blob/v0.7.0-libusb1-sys/libusb1-sys/build.rs#L27
        darwin.DarwinTools
      ];

    buildInputs =
      [
        # Neeeded by alloy-signer-{ledger,trezor,wallet}
        libusb1
        openssl
        zstd
        rdkafka
      ]
      ++ lib.optionals stdenv.isDarwin [
        iconv

        darwin.apple_sdk.frameworks.Security
        darwin.apple_sdk.frameworks.AppKit

        # Used by ggml / llama.cpp
        darwin.apple_sdk.frameworks.Accelerate

        curl
      ];

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    doCheck = false;
    strictDeps = true;

    preBuild = lib.optionalString stdenv.isLinux ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
  };

  cargoDeps = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });

  blocksense-rs = craneLib.buildPackage (
    sharedAttrs
    // {
      inherit version;
      cargoArtifacts = cargoDeps;
    }
  );

  root-cargo-toml = craneLib.cleanCargoToml { cargoToml = "${root}/Cargo.toml"; };

  workspace-members = root-cargo-toml.workspace.members;
  workspace-dependencies = root-cargo-toml.workspace.dependencies;

  workspace-dependencies-with-path = lib.filterAttrs (
    key: value: builtins.isAttrs value && builtins.hasAttr "path" value
  ) workspace-dependencies;

  # testing = resolveLocalDependencies (root + /. + "/apps/../apps/sequencer");
  # testing = resolveLocalDependencies (root + /. + "/apps/sequencer");
  # testing = resolveLocalDependencies (root + "/libs/feeds_processing");
  # testing = resolveTransitiveLocalDependencies (root + "/apps/sequencer");
  # testing = fileSetForCrate (root + "/libs/feeds_processing");
  testing = packageWorkspaceMembers;
in
{
  inherit blocksense-rs;
  inherit testing;
}
# craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
