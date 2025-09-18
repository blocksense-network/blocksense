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
  version ? "dev",
}:
let
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
      CARGO_PROFILE = "dev";
    };

    doCheck = false;
    strictDeps = true;

    preBuild = lib.optionalString stdenv.isLinux ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "blocksense-cargo-deps"; });
in
craneLib.buildPackage (sharedAttrs // { inherit version cargoArtifacts; })
