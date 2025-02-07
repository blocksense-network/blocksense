{
  hostPlatform,
  runCommand,
  spin,
  writers,
  ...
}:
args@{
  name,
  description,
  homepage,
  license,
  packages,
  spinCompatibility,
  version,
}:
let
  os =
    {
      linux = "linux";
      darwin = "osx";
    }
    .${hostPlatform.parsed.kernel.name};

  arch =
    {
      x86_64 = "amd64";
      aarch64 = "aarch64";
    }
    .${hostPlatform.parsed.cpu.name};

  mkSpinPackageDescription =
    pkg:
    let
      # Given a path, which is the result of an expression like "${pkg}", e.g.:
      # /nix/store/yyrbizpsm928xsy8izd3qhwc21ynysw4-blocksense-dev/bin/trigger-oracle
      # ^^^^^^^----------- dirname                                     ^------------- basename

      # We should create an archive with the following structure:
      # ./trigger-oracle
      # To do so, we need to change dir `-C` to the dirname and specify the basename.
      basename = builtins.baseNameOf pkg;
      dirname = builtins.dirOf pkg;
      archive = runCommand "${basename}-spin-plugin-archive.tar.gz" { } ''
        tar czf "$out" -C "${dirname}" "${basename}"
      '';
    in
    {
      inherit os arch;
      url = "file://${archive}";
      sha256 = builtins.hashFile "sha256" archive;
    };

  spinManifestJson = writers.writeJSON "${args.name}.json" (
    args
    // {
      packages = builtins.map mkSpinPackageDescription args.packages;
    }
  );

  spinStateDir =
    let
      stateDir = runCommand "" { } ''
        mkdir -p $out
        XDG_DATA_HOME=$out ${spin} plugin install --yes --file ${spinManifestJson}
      '';
    in
    stateDir;
in
spinStateDir
