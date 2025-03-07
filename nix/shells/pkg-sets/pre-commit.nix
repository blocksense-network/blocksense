{ self', ... }:
{
  # Libraries used when cargo-check builds libraries
  packages = self'.legacyPackages.commonLibDeps;

  pre-commit.hooks = {
    nixfmt-rfc-style.enable = true;
    editorconfig-checker = {
      excludes = [ "libs/sdk/wit/deps" ];
      enable = true;
    };
    cargo-check = {
      enable = true;
      package = self'.legacyPackages.cargoWrapped;
    };
    rustfmt = {
      enable = true;
      packageOverrides = {
        cargo = self'.legacyPackages.rustToolchain;
        rustfmt = self'.legacyPackages.rustToolchain;
      };
    };
    prettier = {
      enable = true;
      args = [
        "--check"
        "--list-different=false"
        "--log-level=warn"
        "--ignore-unknown"
        "--write"
      ];
    };
  };
}
