{
  self,
  cfg,
  pkgs,
  lib,
  ...
}@specialArgs:
with lib;
let
  mkSubmodule =
    module:
    lib.types.submoduleWith {
      inherit specialArgs;
      modules = [ module ];
    };
in
{
  enable = mkEnableOption (mdDoc ''
    Enable the Blocksense sequencer and reporter node services.
  '');

  logsDir = mkOption {
    type = types.nullOr types.path;
    default = null;
    description = mdDoc "The directory to store the logs.";
  };

  package = mkOption {
    type = types.package;
    default = pkgs.erigon;
    description = mdDoc "Package to use as Sequencer node.";
  };

  sequencer = import ./sequencer lib;

  oracles = mkOption {
    type = types.attrsOf (mkSubmodule ./oracle-script.nix);
    default = { };
    description = mdDoc "The set of oracle scripts to build.";
  };

  reporters = mkOption {
    type = types.attrsOf (mkSubmodule ./reporter.nix);
    default = { };
    description = mdDoc "The set of reporter instances to run.";
  };

  anvil = mkOption {
    type = types.attrsOf (mkSubmodule ./anvil.nix);
    default = { };
    description = mdDoc "The Anvil instance to use.";
  };

  blama = mkOption {
    type = mkSubmodule ./blama.nix;
    default = { };
    description = mdDoc "The Blama instance to use.";
  };

  config-files = mkOption {
    type = types.attrsOf (mkSubmodule ./config-files/submodule.nix);
    default = import ./config-files { inherit self cfg lib; };
  };

  config-dir = mkOption {
    type = types.package;
    readOnly = true;
    default =
      let
        configs = lib.attrValues cfg.config-files;
        paths = builtins.map (conf: conf.path) configs;
      in
      pkgs.linkFarmFromDrvs "blocksense-config-dir" paths;
  };
}
