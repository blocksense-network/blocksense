{
  pkgs,
  shellName,
  lib,
  ...
}:
{
  imports = [ ./pre-commit.nix ];

  packages = with pkgs; [
    figlet
    clolcat
    jq
    curl
    oras
    just
  ];

  enterShell =
    let
      envSecrets = [
        "CMC_API_KEY"
        "YF_FINANCE_API_KEY"
        "ALPHAVANTAGE_API_KEY"
        "YAHOO_FINANCE_API_KEY"
        "TWELVEDATA_API_KEY"
        "FMP_API_KEY"
      ];
      template = secret: ''
        if [ "''${${secret}:-}" != "" ]; then
          echo "''$${secret}" > nix/test-environments/test-keys/${secret}
        fi
      '';
    in
    lib.concatStringsSep "\n" (lib.map template envSecrets)
    + ''
      {
        figlet -f smslant -t 'Blocksense'
        figlet -f smslant -t 'Monorepo'
        figlet -f smslant -t '${shellName} Dev Shell  $ _'
      } | clolcat

      # Set up the environment for the Solidity compiler
      ./nix/scripts/config_solidity_import_mapping.sh

      export GIT_ROOT="$(git rev-parse --show-toplevel)"

      echo ""
      echo "🚀 Most useful just targets:"
      echo "  📦 just build-blocksense     - Build the entire Blocksense system"
      echo "  🏃 just start-blocksense     - Build and start Blocksense with process-compose"
      echo "  🔧 just build-ts [package]   - Build TypeScript packages (default: all)"
      echo "  🧪 just test-ts              - Run TypeScript tests"
      echo "  🔮 just build-oracle <name>  - Build a specific oracle"
      echo "  ⚡ just start-oracle <name>  - Build and start a specific oracle"
      echo ""
      echo "🛠️  Development commands:"
      echo "  🎨 just format               - Format all code (JS/Rust/Nix)"
      echo "  🔍 just lint                 - Run all linters"
      echo "  🔧 just fix-all              - Format and fix all linting issues"
      echo "  ✅ just check-all            - Run all checks"
      echo "  🧹 just clean                - Clean build artifacts"
      echo ""
      echo "💡 Run 'just' to see all available targets"
      echo ""
    '';
}
