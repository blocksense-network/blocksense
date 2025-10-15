{
  lib,
  pkgs,
  python3,
  sqlite,
  callPackage,
  stdenvNoCC,
  ...
}:
let
  root = ../../..;
  yarnPlugins = root + /.yarn/plugins;

  yarnFilenames = [
    "yarn.lock"
    "package.json"
    ".yarnrc.yml"
  ];

  tsconfigFiles = [
    "tsconfig.json"
  ];

  # List of Yarn workspaces to be included in the derivation.
  # This can be generated with:
  # yarn workspaces list --json | jq -r '.location'
  workspaces = [
    "apps/rollup"
    "apps/social-verification"
    "libs/aztec_contracts"
    "libs/ts/base-utils"
    "libs/ts/config-types"
    "libs/ts/contracts"
    "libs/ts/docs-ui"
    "libs/ts/esbuild-react-compiler-plugin"
    "libs/ts/nextra-theme-docs"
    "libs/ts/onchain-interactions"
    "libs/ts/sol-reflector"
    "libs/ts/ui"
  ];

  yarnDepsSrc =
    with lib.fileset;
    unions [
      yarnPlugins
      (fileFilter (file: builtins.elem file.name yarnFilenames) root)
    ];

  typeScriptSrc =
    with lib.fileset;
    unions [
      yarnDepsSrc
      (fileFilter (file: (builtins.elem file.name tsconfigFiles)) root)
      (root + /beacon-light-client/plonky2/input_fetchers)
      (root + /beacon-light-client/plonky2/common_config.json)
      (root + /beacon-light-client/plonky2/kv_db_constants.json)
      (root + /beacon-light-client/solidity)
      (root + /libs/typescript)
      (root + /relay)
      (root + /rollup)
      (root + /thirdparty/typescript/libs/redis-work-queue)
    ];

  yarnProject = callPackage ./yarn-project.generated.nix { nodejs = pkgs.nodejs_24; } {
    src =
      with lib.fileset;
      toSource {
        inherit root;
        fileset = yarnDepsSrc;
      };
    overrideAttrs = oldAttrs: {
      dontFixup = true;
      buildInputs =
        (oldAttrs.buildInputs or [ ])
        ++ [
          python3
          sqlite
        ]
        ++ lib.optionals pkgs.stdenv.isDarwin [
          pkgs.darwin.DarwinTools
        ]
        ++ lib.optionals pkgs.stdenv.isLinux [
          pkgs.udev
        ];
    };
  };

  finalProject = stdenvNoCC.mkDerivation {
    name = "input-fetchers";
    src =
      with lib.fileset;
      toSource {
        inherit root;
        fileset = typeScriptSrc;
      };
    nativeBuildInputs = yarnProject.buildInputs;
    postUnpack = ''
      dir=${yarnProject}/libexec/blocksense
      cp --reflink=auto --recursive --no-preserve=all $dir/. /build/source
    '';
    buildPhase =
      # NODE_OPTIONS="--experimental-import-meta-resolve" yarn build:all
      ''
        just build-ts
      '';
    dontFixup = true;
    installPhase = ''
      installWorkspace() {
        local workspace="$1"
        mkdir -p "$dst/$workspace"
        mv "$PWD/$workspace"/{package.json,dist} "$dst/$workspace"
        (
          cd "$dst/$workspace"
          yarn nixify install-bin $out/bin
        )
      }

      fixupNodeOptions() {
        EXTRA_NODE_OPTIONS="--max-old-space-size=32768"

        for bin in $out/bin/*; do
          sed -i "s|NODE_OPTIONS='|NODE_OPTIONS='$EXTRA_NODE_OPTIONS |" $bin
        done
      }

      dst="$out/libexec/$name"
      mkdir -p "$dst" "$out/bin"
      mv $PWD/{.yarn,.pnp.cjs,.pnp.loader.mjs,.yarnrc.yml,yarn.lock,package.json} "$dst/"

      # Install executables listed in workspaces' package.json as "bin"
      for w in ${toString workspaces}; do
        installWorkspace "$w"
      done

      fixupNodeOptions

      rm -rf ".yarn"/{plugins,sdk}
    '';

    doInstallCheck = true;
    installCheckPhase = ''
      join_arr() {
        local IFS="$1"
        shift
        echo "$*"
      }

      set +e

      echo "Executing check phase"

      failing_scripts=()

      for bin in $out/bin/*; do
        bin_name=$(basename $bin)

        echo "Testing \"$bin_name --help\"..."

        stderr=$($bin --help 2>&1 >/dev/null)
        exit_code=$?

        if [[ $exit_code -ne 0 ]]; then
          failing_scripts+=($bin_name)

          echo "\`$bin_name --help\` failed. Make sure it supports \`--help\`
          stderr:
            $stderr"
        fi
      done

      if [ ''${#failing_scripts[@]} -ne 0 ]; then
        echo "Scripts failed: ''${failing_scripts[@]}"
        exit 1
      fi
    '';
  };
in
{
  inherit yarnProject finalProject;
}
