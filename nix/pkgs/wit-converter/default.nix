{
  lib,
  craneLib,
  pkg-config,
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
    pname = "wit-converter";
    inherit (filesets.nodeSoftwareSrc) src;

    nativeBuildInputs = [
      git
      pkg-config
      zstd
      rdkafka
    ]
    ++ lib.optionals stdenv.isLinux [ autoPatchelfHook ]
    ++ lib.optionals stdenv.isDarwin [
      # Needed by https://github.com/a1ien/rusb/blob/v0.7.0-libusb1-sys/libusb1-sys/build.rs#L27
      darwin.DarwinTools
    ];

    buildInputs = [
      openssl
      zstd
    ]
    ++ lib.optionals stdenv.isDarwin [
      iconv
      curl
    ];

    cargoExtraArgs = "-p wit-converter";

    env = {
      ZSTD_SYS_USE_PKG_CONFIG = true;
    };

    doCheck = false;
    strictDeps = true;

    preBuild = lib.optionalString stdenv.isLinux ''
      addAutoPatchelfSearchPath ${libgcc.lib}/lib/
    '';
  };

  cargoArtifacts = craneLib.buildDepsOnly (sharedAttrs // { name = "wit-converter-cargo-deps"; });
in
craneLib.buildPackage (
  sharedAttrs
  // {
    inherit version cargoArtifacts;
  }
)
