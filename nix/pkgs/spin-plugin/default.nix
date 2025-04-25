{
  hostPlatform,
  runCommand,
  spin,
  writers,
  lib,
  ...
}:
manifestArgs:
let
  manifest =
    (lib.evalModules {
      modules = [
        (
          with lib;
          with lib.types;
          {
            options = {
              name = mkOption { type = str; };
              description = mkOption { type = str; };
              homepage = mkOption { type = str; };
              license = mkOption { type = str; };
              packages = mkOption { type = listOf path; };
              spinCompatibility = mkOption { type = str; };
              version = mkOption { type = str; };
            };
          }
        )
        manifestArgs
      ];
    }).config;

  os =
    {
      linux = "linux";
      darwin = "macos";
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

  spinManifestJson = writers.writeJSON "${manifest.name}.json" (
    manifest
    // {
      packages = builtins.map mkSpinPackageDescription manifest.packages;
    }
  );

  spinStateDir =
    let
      stateDir = runCommand "" { } ''
        mkdir -p $out
        SPIN_DATA_DIR=$out ${spin} plugin install --yes --file ${spinManifestJson}
      '';
    in
    stateDir;
in
spinStateDir
