{
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
  ];

  enterShell = ''
    {
      figlet -f smslant -t 'Blocksense'
      figlet -f smslant -t 'Monorepo'
      figlet -f smslant -t '${shellName} Dev Shell  $ _'
    } | clolcat
  '';
}
