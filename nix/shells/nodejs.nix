{
  pkgs,
  inputs',
  ...
}: let
  nodejs = pkgs.nodejs_21;
  oldYarn = pkgs.yarn.override {inherit nodejs;};
  yarn = pkgs.yarn-berry.override {
    inherit nodejs;
    yarn = oldYarn;
  };
in
  pkgs.mkShell {
    packages =
      [
        nodejs
        yarn
      ]
      ++ (with pkgs; [
        figlet
        clolcat
        alejandra
      ]);

    shellHook = ''
      {
        figlet -f smslant -t 'Blocksense'
        figlet -f smslant -t 'Monorepo'
        figlet -f smslant -t 'Dev Shell  $ _'
      } | clolcat
    '';
  }
