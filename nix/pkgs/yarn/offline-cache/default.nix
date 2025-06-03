{
  yarnLock,
  yarn-berry,
}:
yarn-berry.fetchYarnBerryDeps rec {
  inherit yarnLock;
  missingHashes = ./missing-hash.json;
  src = null;
  hash = builtins.readFile ./nix-hash.txt;
  passthru = { inherit missingHashes; };
}
