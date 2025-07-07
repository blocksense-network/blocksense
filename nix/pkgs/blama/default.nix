{
  stdenv,
  lib,
  fetchFromGitHub,
  fetchgit,
  cmake,
  cudaPackages,
  gitMinimal,
  gnused,
  jq,
  moreutils, # for `sponge`
  autoPatchelfHook,

  # NOTE: from flake inputs
  blama-src,

  # TODO: test on a `gpu-server`
  cudaSupport ? false,
  preset ? "debug",
}:

let
  cpm-src = fetchFromGitHub {
    owner = "cpm-cmake";
    repo = "CPM.cmake";
    # TODO: set EXTRACTED_CPM_VERSION in cmake
    rev = "v0.40.5";
    hash = "sha256-wJsQNLCwWl4RiheDK36m3O8N4fmdmNazEo4gLdbTEzQ=";
  };

  ac-test-data-llama-drv = fetchgit {
    url = "https://huggingface.co/alpaca-core/ac-test-data-llama";
    rev = "164e484873785c804fe724f88bdb96088b573ebc";
    hash = "sha256-3qKVgqm2wuZLBw0GfY1j9jAiPCdB/q27ra61HTvkPec=";
    fetchLFS = true;
  };

  deps = [
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "icm";
        rev = "v1.5.5";
        hash = "sha256-oKolpM7xsSuaDzn3BNM8kPsQjR82oGRUrlsMyrXxYns=";
      };
      cpm_hash = "87809cfb29c57b6864eab32a5f53abb6292b5491";
    }
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "doctest-util";
        rev = "v0.1.3";
        hash = "sha256-Gxs5WJcvUKfLyf6HaTY8RVxYSAvHtSUm97uCBIwmB40=";
      };
      cpm_hash = "f8bc93c149bc80804850ce3a5407b9c81d8da28b";
      deps = [
        {
          drv = fetchFromGitHub {
            owner = "iboB";
            repo = "doctest-lib";
            rev = "v2.4.11";
            hash = "sha256-M86CcbVQuTXmdURdVumv7uJRTv0wZNOu/scFinBZGUE=";
          };
          cpm_hash = "836bc30ad8890b0636c5fd978e148762d84e48e3";
        }
      ];
    }
    {
      name = "ac-test-data-llama";
      # TODO: get away with not copying the models themselves, just the needed `ac-test-data-llama-dir.in.h` somehow
      #       since we already patch that to point to this derivation directly
      drv = ac-test-data-llama-drv;
      cpm_hash = "02173a7dc6f5afcbfd3ce19f3c8beb981fa49c65";
    }
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "splat";
        rev = "v1.3.3";
        hash = "sha256-pdklnyc8MCQ1/R0D029YY5s1pSgrbH3UKzs7K71PYIs=";
      };
      prefix = "common/bstl/include";
      cpm_hash = "9eed47e22e4b4a5bf3b7eeab1932f174a1eb65d8";
    }
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "itlib";
        rev = "v1.11.7";
        hash = "sha256-84+IHURUEuMF9MIIAd1of+4Yucd9crb6IabaQD7dmkg=";
      };
      prefix = "inference/code";
      cpm_hash = "c94e3f331ac78bb3c7f3f07c8f1f093b890490c9";
    }
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "jalog";
        rev = "v0.5.0";
        hash = "sha256-e48ZtyHZ0bVSqCwRp9hFCjNwcdrE/8pcCVIQfNLuzaE=";
      };
      prefix = "inference/code";
      cpm_hash = "ad3199fdf6bc9332105e1770a045b94086cf5166";
    }
    {
      drv = fetchFromGitHub {
        owner = "google";
        repo = "minja";
        rev = "dee1b8921ccdc51846080fda5299bae2b592d354";
        hash = "sha256-onWADtHbzAW/k3hBajhHX4DGIR0YkCBa9rGoCk6ypLo=";
      };
      prefix = "inference/code";
      cpm_hash = "949ae20943881e50c270152fa0e6711925c99307";
    }
    {
      drv = fetchFromGitHub {
        owner = "nlohmann";
        repo = "json";
        rev = "v3.12.0";
        hash = "sha256-cECvDOLxgX7Q9R3IE86Hj9JJUxraDQvhoyPDF03B2CY=";
      };
      prefix = "inference/code";
      cpm_hash = "b88ca108e0b5a597e859a21658d11fa5f1feb410";
    }
    {
      drv = fetchFromGitHub {
        owner = "ggml-org";
        repo = "llama.cpp";
        rev = "b5187";
        hash = "sha256-e9werNnoOZbHvwegN+L0iMD5TM1KTzcgZm3QRY7x4gQ=";
      };
      prefix = "inference/code";
      cpm_hash = "a83f57aeea0b13ffce6111430d193fb24712dc47";
    }
    {
      drv = fetchFromGitHub {
        owner = "iboB";
        repo = "boost-trim";
        rev = "v1.85.0";
        hash = "sha256-0j3lcaMht41guxoQxqnASeFxH9nyT9jprxlHkRnV1ns=";
      };
      prefix = "server/code";
      cpm_hash = "eec2d62b61c5789ff2268ec7f099770a9dfedde6";
    }
  ];

  # NOTE:
  # Recursive function to generate the shell script for pre-fetching.
  # Args:
  #   - cacheBaseDir: The base path for the current level of dependencies.
  #                   Starts as "$CPM_CACHE_DIR".
  #   - depList: The list of dependencies to process at this level.
  generatePrefetchScript =
    cacheBaseDir: depList:
    lib.pipe depList [
      (lib.map (
        {
          name ? drv.repo,
          drv,
          cpm_hash,
          deps ? [ ],
          prefix ? "",
        }:
        let
          cacheDir = if prefix != "" then "${prefix}/cpm_cache" else cacheBaseDir;

          # The location where the source for this dependency will be placed.
          sourceDir = "${cacheDir}/${name}/${cpm_hash}";

          # If there are sub-dependencies, recursively generate their script.
          # The new base cache directory is inside this dependency's sourceDir.
          # Will yield an empty string if there are no sub-dependencies.
          subDepsScript = generatePrefetchScript "${sourceDir}/cpm_cache" deps;
        in
        # bash
        ''
          # Create the directory for the current dependency and copy its source.
          # We cannot seem to get away with symlinking because `cmake` tries editing the files in there.
          mkdir -p ${sourceDir}
          cp -a --no-preserve=mode ${drv}/. ${sourceDir}

          # Patch the dependency's own references to `CPM` (similar to `blama` itself)
          find "${sourceDir}" -type f -name "CMakeLists.txt" | while IFS= read -r file; do
            substituteInPlace "$file" \
              --replace-quiet "include(./get_cpm.cmake)" "include(${cpm-src}/cmake/CPM.cmake)"
          done

          echo "Prefetched ${name} at ${sourceDir}"

          # Append the script for any sub-dependencies.
          ${subDepsScript}
        ''
      ))
      (lib.concatStringsSep "\n")
    ];

  # FIXME: doesn't correctly calculate the hashes, trace back from <https://github.com/cpm-cmake/CPM.cmake/blob/d9364ce284d92f4e18a96a7ca27e2c5deecf6700/cmake/CPM.cmake#L870>
  # calculateCpmHash =
  #   drv:
  #   let
  #     cpmParameters = [
  #       "GIT_REPOSITORY"
  #       drv.gitRepoUrl
  #       "GIT_TAG"
  #       drv.rev
  #       "GIT_SHALLOW"
  #       "TRUE"
  #     ];
  #     sortedParameters = lib.sort builtins.lessThan cpmParameters;
  #     stringToHash = lib.concatStringsSep ";" sortedParameters;
  #     cpmHash = builtins.hashString "sha1" stringToHash;
  #   in
  #   cpmHash;

in
stdenv.mkDerivation {
  pname = "blama";
  # TODO: real versioning?
  version = "0.1.0";

  src = blama-src;

  nativeBuildInputs =
    [
      cmake
      gitMinimal
      gnused
      jq
      moreutils
    ]
    ++ lib.optionals cudaSupport [
      cudaPackages.cudatoolkit
    ]
    ++ lib.optionals stdenv.isLinux [
      autoPatchelfHook
    ];

  buildInputs = [ ];

  preConfigure = ''
    # NOTE: default
    export CPM_CACHE_DIR="./cpm_cache"
    mkdir -p $CPM_CACHE_DIR
    echo "Populating CPM cache in $CPM_CACHE_DIR for dependencies"

    # Fix CPM reference in blama
    substituteInPlace ./CMakeLists.txt \
      --replace-quiet "include(./get_cpm.cmake)" "include(${cpm-src}/cmake/CPM.cmake)"

    # Populate cache with vendored deps (also fixing CPM references in them)
    ${generatePrefetchScript "$CPM_CACHE_DIR" deps}

    # Remove hardcoded installtion directories from the cmake presets
    jq 'del(.configurePresets[] | .binaryDir, .installDir)' CMakePresets.json | sponge CMakePresets.json
    cat ./CMakePresets.json

    # Redirect `AC_TEST_DATA_LLAMA_DIR` to the derivation
    find . -type f -name "ac-test-data-llama-dir.in.h" | while IFS= read -r file; do
      echo "Fixing \`AC_TEST_DATA_LLAMA_DIR\` reference in $file"
      substituteInPlace "$file" \
        --replace-fail "@CMAKE_CURRENT_SOURCE_DIR@" "${ac-test-data-llama-drv}"
    done

    echo "Linked dependencies for CPMAddPackage"
  '';

  cmakePreset = preset;

  cmakeFlags = [
    (lib.strings.cmakeOptionType "path" "CPM_SOURCE_CACHE" "./cpm_cache")
    # (lib.strings.cmakeOptionType "bool" "CMAKE_VERBOSE_MAKEFILE" "ON")
    (lib.strings.cmakeOptionType "bool" "CMAKE_SKIP_BUILD_RPATH" "ON")
    # TODO: guard behind options
    (lib.strings.cmakeOptionType "bool" "BLAMA_BUILD_TESTS" "ON")
    (lib.strings.cmakeOptionType "bool" "BLAMA_BUILD_EXAMPLES" "ON")
  ];

  # FIXME: should not need to do this manually
  installPhase = ''
    runHook preInstall

    # Create the standard directories in the output path ($out)
    mkdir -p $out/bin
    mkdir -p $out/lib

    echo "Manually installing build artifacts to $out..."

    # Copy the main executable(s) to $out/bin
    # The log shows it's in a 'bin' subdirectory of the build folder.
    cp -v bin/blama-http-server $out/bin/

    # You can also copy the examples if you want them in the final package
    cp -v bin/example-bl-server-cli $out/bin/

    # Copy all the built shared libraries to $out/lib
    # We use 'find' to locate them all within the build directory.
    find . -name "*${stdenv.hostPlatform.extensions.sharedLibrary}" -exec cp -v {} $out/lib/ \;

    echo "Installation complete. Final contents of $out:"
    ls -lR $out

    runHook postInstall
  '';

  fixupPhase = lib.optionalString stdenv.isDarwin ''
    for exe in $out/bin/*; do
      install_name_tool -add_rpath $out/lib $exe
    done
  '';

  meta = with lib; {
    description = "AlpacaCore and llama.cpp based HTTP server for LLM inference";
    homepage = "https://github.com/blocksense-network/blama";
    # FIXME: no license
    # license = licenses.nonfree;
    platforms = platforms.linux ++ platforms.darwin;
    mainProgram = "blama-http-server";
  };
}
