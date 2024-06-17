{
  lib,
  pkgs,
  shellName,
  ...
}: {
  imports = [
    ./pre-commit.nix
  ];

  packages = with pkgs; [
    figlet
    clolcat
    alejandra
    jq
    curl
  ];

  enterShell = ''
    {
      figlet -f smslant -t 'Blocksense'
      figlet -f smslant -t 'Monorepo'
      figlet -f smslant -t '${shellName} Dev Shell  $ _'
    } | clolcat

    # Set up the environment for the Solidity compiler
    ./nix/scripts/config_solidity_import_mapping.sh

    export LD_LIBRARY_PATH="${lib.makeLibraryPath [pkgs.openssl pkgs.curl]}:$LD_LIBRARY_PATH"
  '';
}
