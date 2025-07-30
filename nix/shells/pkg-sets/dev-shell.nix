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
    findutils
    process-compose
    ripgrep
  ];

  # NOTE: throughout the code, we're relying on `$GIT_ROOT` to be set
  #       (intented to be used instead of `devenv`'s `root`),
  #       so we make sure that it's set at the earlier convenience, using
  #       the `lib.mkBefore` below
  enterShell = lib.mkBefore (
    let
      envSecrets = [
        "CMC_API_KEY"
        "YF_FINANCE_API_KEY"
        "APCA_API_KEY_ID"
        "APCA_API_SECRET_KEY"
        "ALPHAVANTAGE_API_KEY"
        "YAHOO_FINANCE_API_KEY"
        "TWELVEDATA_API_KEY"
        "FMP_API_KEY"
        "SPOUT_RWA_API_KEY"
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
    ''
  );
}
