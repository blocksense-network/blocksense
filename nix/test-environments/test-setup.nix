{
  lib,
  ...
}:
let
  root = ../..;

  testKeysDir = lib.path.append root "./nix/test-environments/test-keys";
in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/test-setup";

    reporters = {
      a = {
        api-keys = lib.mkForce (
          lib.traceValSeq (lib.genAttrs (import ../env-vars.nix) (name: "${testKeysDir}/${name}"))
        );
      };
    };
  };
}
