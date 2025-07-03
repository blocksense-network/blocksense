{ inputs, ... }:
{
  perSystem =
    { config, inputs', self', ... }:
    let
      createShell =
        {
          module,
          shellName,
          extraImports ? [ ./pkg-sets/dev-shell.nix ],
        }:
        {
          imports = [
            {
              _module.args = {
                inherit inputs' self' shellName;
              };
            }
            # inputs.devenv.flakeModules.readDevenvRoot
            {
              devenv.root = "/home/reo101/Projects/Metacraft/blocksense";
            }
            module
          ] ++ extraImports;
        };
    in
    {
      devenv.shells = {
        default = createShell {
          module = ./pkg-sets/all.nix;
          shellName = "Main";
        };
        rust = createShell {
          module = ./pkg-sets/rust.nix;
          shellName = "Rust";
        };
        js = createShell {
          module = ./pkg-sets/js.nix;
          shellName = "JS";
        };
        pre-commit = createShell {
          module = ./pkg-sets/pre-commit.nix;
          shellName = "Lint";
          extraImports = [ ];
        };
      };
    };
}
