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
{
  cargoLock ? ../../../Cargo.lock,
  cargoToml ? ../../../Cargo.toml,
  sourceRootDir ? ".",
  extraArgs ? "",
  pname ? "blocksense-cargo",
}:
let
  sharedAttrs = rec {
    inherit pname version;

    src = filesets.rustFilter [ ];

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

    cargoVendorDir = craneLib.vendorCargoDeps { inherit cargoLock; };

    postUnpack = ''
      cd $sourceRoot/${sourceRootDir}
      sourceRoot="."
    '';

    inherit cargoToml;

    preBuild = lib.optionalString stdenv.isLinux ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
    cargoExtraArgs = extraArgs;
  };
in
craneLib.buildDepsOnly (
  sharedAttrs
  // {
    passthru = {
      inherit sharedAttrs;
    };
  }
)
