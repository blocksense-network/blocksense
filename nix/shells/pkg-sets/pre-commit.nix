{ pkgs, ... }:
{
  pre-commit.hooks = {
    nixfmt = {
      enable = true;
      package = pkgs.nixfmt-rfc-style;
    };
    editorconfig-checker = {
      excludes = [ "libs/sdk/wit/deps" ];
      enable = true;
    };
    cargo-check.enable = true;
    rustfmt.enable = true;
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
