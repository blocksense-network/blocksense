{
  runCommand,

  mkYarnPackagesFromManifest ? throw "Pass `inputs.yarnpnp2nix.lib.\${system}.mkYarnPackagesFromManifest` here",
}:

let
  yarnPackages = mkYarnPackagesFromManifest {
    yarnManifest = import ./yarn-manifest.generated.nix;
    inherit packageOverrides;
  };
  packageOverrides = {
    # Build base-utils to support subpath exports
    "@blocksense/base-utils@workspace:libs/ts/base-utils" = {
      build = ''
        echo "[base-utils] Building package..."

        # Build with esbuild for each export
        mkdir -p dist/cjs dist/esm

        # Build CommonJS versions
        echo "[base-utils] Building CommonJS modules..."

        # Main index
        esbuild src/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/index.cjs --external:fs --external:path --external:crypto --external:http --external:https --external:util --external:zod --external:chalk

        # Build each subpath export
        esbuild src/env/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/env.cjs --external:fs --external:path --external:crypto --external:chalk
        esbuild src/evm/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/evm.cjs --external:zod
        esbuild src/tty.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/tty.cjs --external:chalk
        esbuild src/assert.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/assert.cjs
        esbuild src/async.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/async.cjs
        esbuild src/buffer-and-hex/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/buffer-and-hex.cjs
        esbuild src/errors.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/errors.cjs
        esbuild src/fs.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/fs.cjs --external:fs --external:path
        esbuild src/http.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/http.cjs --external:http --external:https
        esbuild src/logging.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/logging.cjs
        esbuild src/schemas.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/schemas.cjs --external:zod
        esbuild src/string.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/string.cjs
        esbuild src/type-level.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/type-level.cjs
        esbuild src/array-iter.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/cjs/array-iter.cjs

        # Update package.json with proper exports
        cat > package.json << 'EOF'
        {
          "name": "@blocksense/base-utils",
          "exports": {
            ".": {
              "require": "./dist/cjs/index.cjs",
              "types": "./src/index.ts"
            },
            "./env": {
              "require": "./dist/cjs/env.cjs",
              "types": "./src/env/index.ts"
            },
            "./evm": {
              "require": "./dist/cjs/evm.cjs",
              "types": "./src/evm/index.ts"
            },
            "./tty": {
              "require": "./dist/cjs/tty.cjs",
              "types": "./src/tty.ts"
            },
            "./assert": {
              "require": "./dist/cjs/assert.cjs",
              "types": "./src/assert.ts"
            },
            "./async": {
              "require": "./dist/cjs/async.cjs",
              "types": "./src/async.ts"
            },
            "./buffer-and-hex": {
              "require": "./dist/cjs/buffer-and-hex.cjs",
              "types": "./src/buffer-and-hex/index.ts"
            },
            "./errors": {
              "require": "./dist/cjs/errors.cjs",
              "types": "./src/errors.ts"
            },
            "./fs": {
              "require": "./dist/cjs/fs.cjs",
              "types": "./src/fs.ts"
            },
            "./http": {
              "require": "./dist/cjs/http.cjs",
              "types": "./src/http.ts"
            },
            "./logging": {
              "require": "./dist/cjs/logging.cjs",
              "types": "./src/logging.ts"
            },
            "./schemas": {
              "require": "./dist/cjs/schemas.cjs",
              "types": "./src/schemas.ts"
            },
            "./string": {
              "require": "./dist/cjs/string.cjs",
              "types": "./src/string.ts"
            },
            "./type-level": {
              "require": "./dist/cjs/type-level.cjs",
              "types": "./src/type-level.ts"
            },
            "./array-iter": {
              "require": "./dist/cjs/array-iter.cjs",
              "types": "./src/array-iter.ts"
            }
          }
        }
        EOF

        echo "[base-utils] Build completed!"
      '';
    } // {
      build = ''
        yarn workspace @blocksense/base-utils build
      '';
    };

    # Enable build script for chain-interactions to generate dist/bin.cjs
    # We use esbuild directly to compile and bundle TypeScript to avoid tsup's PnP issues
    "@blocksense/chain-interactions@workspace:apps/chain-interactions" = {
      build = ''
        echo "[chain-interactions] Starting build..."

        # Create dist directory
        mkdir -p dist

        # Use esbuild to compile and bundle TypeScript directly
        echo "[chain-interactions] Bundling with esbuild..."
        esbuild src/bin.ts \
          --bundle \
          --platform=node \
          --target=node18 \
          --format=cjs \
          --outfile=dist/bin.cjs \
          --external:@parcel/watcher \
          --minify-whitespace \
          --keep-names

        # Create package.json for the dist folder
        echo "[chain-interactions] Creating package.json..."
        cat > dist/package.json << 'EOF'
        {
          "name": "@blocksense/chain-interactions",
          "version": "0.0.0",
          "type": "commonjs",
          "main": "bin.cjs",
          "bin": "bin.cjs"
        }
        EOF

        # Make the binary executable
        chmod +x dist/bin.cjs

        echo "[chain-interactions] Build completed successfully!"
      '';
    };

    # Enable build script for onchain-interactions to generate dist/scripts/*.js
    # We use tsc directly to compile TypeScript, avoiding yarn invocation issues
    "@blocksense/onchain-interactions@workspace:libs/ts/onchain-interactions" = {
      build = ''
        echo "[onchain-interactions] Using unified build script..."

        # Set environment variables to use esbuild with CommonJS output
        export USE_ESBUILD=true
        export BUILD_FORMAT=cjs
        export UPDATE_PACKAGE_JSON=true
        export NIX_BUILD=true

        # Run the build script
        node build.mjs
      '';
    };

    # TODO: Investigate why our build depends on the `usb` and `node-hid` packages
    # These should NOT be dependencies of @blocksense/base-utils or onchain-interactions
    # They're only needed for hardware wallet support (Ledger) when deploying contracts
    # which is not the responsibility of these packages
    #
    # These native modules are problematic in sandboxed builds
    # They're only needed for hardware wallet support which likely won't be used in production
    # We'll override with stub source that doesn't need native compilation
    "node-hid@npm:2.1.2" = {
      # Provide a fake source that creates a stub implementation
      src = runCommand "node-hid-stub" {} ''
        mkdir -p $out/src
        cat > $out/index.js << 'EOF'
        throw new Error('node-hid is not available in this build. Hardware wallet support is disabled.');
        EOF

        cat > $out/package.json << 'EOF'
        {
          "name": "node-hid",
          "version": "2.1.2",
          "main": "index.js",
          "bin": {
            "hid-showdevices": "src/show-devices.js"
          }
        }
        EOF

        # Create a stub for the binary in the expected location
        cat > $out/src/show-devices.js << 'EOF'
        #!/usr/bin/env node
        console.log('No HID devices available (stub implementation)');
        EOF
        chmod +x $out/src/show-devices.js
      '';
    };

    "usb@npm:2.9.0" = {
      # Provide a fake source that creates a stub implementation
      src = runCommand "usb-stub" {} ''
        mkdir -p $out
        cat > $out/index.js << 'EOF'
        // Stub implementation of usb for sandboxed builds
        // Hardware wallet support will not work with this stub
        module.exports = {
          getDeviceList: () => [],
          findByIds: () => null,
          on: () => {},
          off: () => {},
          removeAllListeners: () => {}
        };
        EOF

        cat > $out/package.json << 'EOF'
        {
          "name": "usb",
          "version": "2.9.0",
          "main": "index.js"
        }
        EOF
      '';
    };
  };
in
  yarnPackages
