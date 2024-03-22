{...}: {
  perSystem = {
    pkgs,
    inputs',
    ...
  }: let
    pkgSets = {
      dev-shell = import ./pkg-sets/dev-shell.nix {inherit pkgs inputs';};
      js = import ./pkg-sets/js.nix {inherit pkgs inputs';};
      rust = import ./pkg-sets/rust.nix {inherit pkgs inputs';};
    };

    createShell = pkgSet: name:
      pkgs.mkShell {
        packages = pkgSets.dev-shell ++ pkgSet;

        shellHook = ''
          {
            figlet -f smslant -t 'Blocksense'
            figlet -f smslant -t 'Monorepo'
            figlet -f smslant -t '${name} Dev Shell  $ _'
          } | clolcat
        '';
      };
  in {
    devShells = {
      default = createShell (pkgSets.js ++ pkgSets.rust) "Main";
      rust = createShell pkgSets.rust "Rust";
      js = createShell pkgSets.js "JS";
    };
  };
}
