{
  # Lib
  lib,

  # Helpers
  hostPlatform,
  runCommand,
  writers,

  # Packages
  spin,
  jq,
  moreutils, # sponge

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

  packagelessManifest = lib.pipe manifest [
    (attrs: attrs // { packages = [ ]; })
    (writers.writeJSON "${manifest.name}.json")
  ];

  vendoredSpinPlugins =
    runCommand "vendored-spin-plugins"
      {
        nativeBuildInputs = [
          jq
          moreutils
        ];
      } # bash
      ''
        mkdir -p $out

        # Serialize all of the manifest but the original `packages` array (since its a list of Nix paths)
        manifest_path=./spin_manifest.json
        cp --no-preserve=mode ${packagelessManifest} "$manifest_path"

        # Re-add all packages, `tar`-ing then up and calculating their `sha256sum`s at **build-time** (not eval-time!)
        ${lib.pipe manifest.packages [
          (lib.map (
            pkgPath:
            let
              # Given a path, which is the result of an expression like "${pkg}", e.g.:
              # /nix/store/yyrbizpsm928xsy8izd3qhwc21ynysw4-blocksense-dev/bin/trigger-oracle
              # ^^^^^^^----------- dirname                                     ^------------- basename

              # We should create an archive with the following structure:
              # ./trigger-oracle
              # To do so, we need to change dir `-C` to the dirname and specify the basename.
              basename = builtins.baseNameOf pkgPath;
              dirname = builtins.dirOf pkgPath;
              archive = runCommand "${basename}-spin-plugin-archive.tar.gz" { } ''
                tar czf "$out" -C ${dirname} ${basename}
              '';
              basenameOffset = lib.pipe basename [
                builtins.stringLength
                (lib.flip lib.strings.replicate "#")
              ];
            in
            # bash
            ''
              ###################${basenameOffset}####
              ### ADDING PACKAGE ${basename} ###
              ###################${basenameOffset}####

              # To avoid quoting hell we construct the new `package` entry using `jq -n`
              package_obj=$(jq -n \
                --arg os ${os} \
                --arg arch ${arch} \
                --arg url file://${archive} \
                --arg sha256 "$(sha256sum ${archive} | cut -d' ' -f1)" \
                '{os: $os, arch: $arch, url: $url, sha256: $sha256}')

              # Then we insert it back into the json
              jq --argjson package_obj "$package_obj" '.packages += [$package_obj]' "$manifest_path" | sponge "$manifest_path"
            ''
          ))
          (lib.concatStringsSep "\n")
        ]}

        SPIN_DATA_DIR=$out ${spin} plugin install --yes --file "$manifest_path"
      '';
in
vendoredSpinPlugins
