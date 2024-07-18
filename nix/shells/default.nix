{ ... }:
{
  perSystem =
    { inputs', self', ... }:
    let
      createShell = module: shellName: {
        imports = [
          {
            _module.args = {
              inherit inputs' self' shellName;
            };
          }
          ./pkg-sets/dev-shell.nix
          module
        ];
      };
    in
    {
      devenv.shells = {
        default = createShell ./pkg-sets/all.nix "Main";
        rust = createShell ./pkg-sets/rust.nix "Rust";
        js = createShell ./pkg-sets/js.nix "JS";
      };
    };
}
