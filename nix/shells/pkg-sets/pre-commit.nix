{ ... }:
{
  pre-commit.hooks = {
    nixfmt-rfc-style.enable = true;
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
