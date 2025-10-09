{
  lib,
  self',
  inputs',
  ...
}:
{
  # Libraries used when cargo-check builds libraries
  packages = self'.legacyPackages.commonLibDeps;

  imports = [ ./js.nix ];

  git-hooks.hooks = {
    nixfmt-rfc-style.enable = true;
    editorconfig-checker = {
      excludes = [ "libs/sdk/wit/deps" ];
      enable = true;
    };
    rustfmt = {
      enable = true;
      packageOverrides = {
        cargo = self'.legacyPackages.rustToolchain;
        rustfmt = self'.legacyPackages.rustToolchain;
      };
    };
    clippy = {
      enable = true;
      packageOverrides = {
        cargo = self'.legacyPackages.cargoWrapped;
        clippy = self'.legacyPackages.rustToolchain;
      };

      settings = {
        allFeatures = true;
        denyWarnings = true;
        extraArgs = "--tests";
        offline = false;
      };
    };
    cargo-sort = {
      enable = true;
      name = "cargo-sort";
      entry =
        let
          exe = lib.getExe inputs'.nixpkgs-unstable.legacyPackages.cargo-sort;
          cmd = workspace: "${exe} --grouped --workspace ${workspace}";
          workspaces = [
            "."
            "apps/oracles"
            "libs/sdk"
          ];
          fullCmd = lib.concatMapStringsSep "; " cmd workspaces;
        in
        "bash -c '${fullCmd}'";

      files = "Cargo\\.toml";
      pass_filenames = false;
      types = [ "file" ];
    };
    statix = {
      enable = true;
    };
    deadnix = {
      enable = true;
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
    eslint = {
      enable = true;
      settings = {
        binPath = "yarn run -T eslint";
        extensions = "\\.[jt]s(x?)$";
      };
    };
  };
}
