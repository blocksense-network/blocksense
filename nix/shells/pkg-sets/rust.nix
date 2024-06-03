{
  pkgs,
  inputs',
  ...
}: {
  packages = with pkgs;
    [
      (with inputs'.fenix.packages;
        with latest;
          combine [
            cargo
            clippy
            rust-analyzer
            rust-src
            rustc
            rustfmt
            targets.wasm32-wasi.latest.rust-std
          ])
      clang
      fermyon-spin
      openssl
      pkg-config
    ]
    ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
      iconv
      darwin.apple_sdk.frameworks.Accelerate
    ];
}
