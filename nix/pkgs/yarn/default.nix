{
  pkgs,
  lib,
}:
let
  yarn-berry = pkgs.yarn-berry_4;
  filterWorkspaces = pkgs.callPackage ./filter { };
  offlineCache = pkgs.callPackage ./offline-cache {
    inherit yarn-berry;
    yarnLock = ../../../yarn.lock;
  };
  buildYarnWorkspace = pkgs.callPackage ./buildYarnWorkspace {
    inherit yarn-berry filterWorkspaces;
    inherit offlineCache;
    inherit (offlineCache) missingHashes;
  };
  readJson = file: builtins.fromJSON (builtins.readFile file);

  baseUtilsDeps = buildYarnWorkspace { };
  onchainInteractionsDeps = buildYarnWorkspace { folders = [ "libs/ts/onchain-interactions" ]; };

in
rec {
  _all = pkgs.symlinkJoin {
    name = "yarn-all";
    paths = [
      offlineCache
      baseUtilsDeps
      onchainInteractionsDeps
    ] ++ (lib.attrValues onchain-interactions);
  };
  inherit offlineCache;

  onchain-interactions = builtins.listToAttrs (
    builtins.map (name: {
      inherit name;
      value = pkgs.writeShellScriptBin name ''
        #!${pkgs.bash}/bin/bash
        cd ${onchainInteractionsDeps}
        export GIT_ROOT="${onchainInteractionsDeps}"
        ${yarn-berry}/bin/yarn workspace @blocksense/onchain-interactions run ${name} "''$@"
      '';
    }) (lib.attrNames (readJson ../../../libs/ts/onchain-interactions/package.json).scripts)
  );

}
