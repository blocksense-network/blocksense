{
  self',
  pkgs,
  ...
}:
{
  # Libraries used when cargo-check builds libraries plus linting tools
  packages = self'.legacyPackages.commonLibDeps ++ [
    pkgs.statix
    pkgs.deadnix
    pkgs.editorconfig-checker
  ];

  pre-commit.hooks = {
    nixfmt-rfc-style = {
      enable = true;
      verbose = true;
      # Show specific help when this hook fails
      fail_fast = false;
    };
    editorconfig-checker = {
      enable = false; # Disable built-in, use custom below
    };
    rustfmt = {
      enable = true;
      packageOverrides = {
        cargo = self'.legacyPackages.rustToolchain;
        rustfmt = self'.legacyPackages.rustToolchain;
      };
      verbose = true;
      fail_fast = false;
    };
    clippy = {
      enable = false; # Disable built-in, use custom below
    };
    statix = {
      enable = false; # Disable built-in, use custom below
    };
    deadnix = {
      enable = false; # Disable built-in, use custom below
    };
    prettier = {
      enable = true;
      verbose = true;
      fail_fast = false;
      args = [
        "--check"
        "--list-different=false"
        "--log-level=warn"
        "--ignore-unknown"
        "--write"
      ];
    };

    # Custom hooks with helpful error messages
    clippy-with-help = {
      enable = true;
      name = "Clippy (Rust linter)";
      entry = "./scripts/clippy-with-help.sh";
      language = "system";
      types = [ "rust" ];
      pass_filenames = false;
      verbose = true;
      fail_fast = false;
    };

    statix-with-help = {
      enable = true;
      name = "Statix (Nix linter)";
      entry = "./scripts/statix-with-help.sh";
      language = "system";
      types = [ "nix" ];
      pass_filenames = false;
      verbose = true;
      fail_fast = false;
    };

    deadnix-with-help = {
      enable = true;
      name = "Deadnix (dead Nix code)";
      entry = "./scripts/deadnix-with-help.sh";
      language = "system";
      types = [ "nix" ];
      pass_filenames = false;
      verbose = true;
      fail_fast = false;
    };

    editorconfig-with-help = {
      enable = true;
      name = "EditorConfig compliance";
      entry = "./scripts/editorconfig-with-help.sh";
      language = "system";
      types = [ "text" ];
      pass_filenames = false;
      verbose = true;
      fail_fast = false;
      excludes = [ "libs/sdk/wit/deps" ];
    };
  };
}
