{
  inputs,
  self,
  ...
}:
{
  perSystem =
    {
      lib,
      pkgs,
      inputs',
      self',
      ...
    }:
    let
      rust = self'.legacyPackages.rustToolchain;

      craneLib = (inputs.mcl-blockchain.inputs.crane.mkLib pkgs).overrideToolchain rust;

      version = "dev";

      cargoArtifacts = pkgs.callPackage ./cargo-deps {
        inherit craneLib;
        inherit (self.lib) filesets;
      };

      craneBuilder = pkgs.callPackage ./crane-builder {
        inherit craneLib;
        cargoArtifacts = cargoArtifacts { };
        inherit (self.lib) filesets;
      };

      mkRustPackage =
        pkgSet: builtins.mapAttrs (name: value: craneBuilder (value // { pname = name; })) pkgSet;

      rust-packages = mkRustPackage rec {
        blocksense-cli = {
          members = [
            "apps/cli"
            "libs/registry"
            "libs/utils"
          ];
        };
        sequencer = {
          members = [
            "apps/sequencer"
            "libs/registry"
            "libs/utils"
            "libs/config"
            "libs/crypto"
            "libs/anomaly_detection"
            "libs/blockchain_data_model"
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
            "libs/feeds_processing"
            "libs/gnosis_safe"
          ];
        };
        sequencer_tests = {
          members = [
            "apps/sequencer_tests"
            "libs/registry"
            "libs/utils"
            "libs/config"
            "libs/crypto"
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
          ];
        };
        trigger-oracle = {
          members = [
            "apps/trigger-oracle"
            "libs/registry"
            "libs/utils"
            "libs/config"
            "libs/crypto"
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
            "libs/sdk"
          ];
        };
        crypto-price-feeds = {
          members = [
            "apps/oracles/crypto-price-feeds"
            "libs/sdk"
          ];
        };
        exsat-holdings = {
          members = [
            "apps/oracles/exsat-holdings"
            "libs/sdk"
          ];
        };
        gecko-terminal = {
          members = [
            "apps/oracles/gecko-terminal"
            "libs/sdk"
          ];
        };
      };

      rust-libraries = mkRustPackage rec {
        anomaly_detection = {
          members = "libs/anomaly_detection";
        };
        blockchain_data_model = {
          members = [
            "libs/blockchain_data_model"
            "libs/utils"
          ];
        };
        config = {
          members = [
            "libs/config"
            "libs/registry"
            "libs/utils"
          ];
        };
        crypto = {
          members = "libs/crypto";
        };
        data_feeds = {
          members = [
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
            "libs/config"
            "libs/registry"
            "libs/utils"
            "libs/crypto"
          ];
        };
        feed_registry = {
          members = [
            "libs/feed_registry"
            "libs/crypto"
            "libs/config"
            "libs/registry"
            "libs/utils"
          ];
        };
        feeds_processing = {
          members = [
            "libs/feeds_processing"
            "libs/anomaly_detection"
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
            "libs/gnosis_safe"
            "libs/crypto"
            "libs/config"
            "libs/registry"
            "libs/utils"
          ];
        };
        gnosis_safe = {
          members = [
            "libs/gnosis_safe"
            "libs/data_feeds"
            "libs/feed_registry"
            "libs/prometheus"
            "libs/crypto"
            "libs/config"
            "libs/registry"
            "libs/utils"
          ];
        };
        prometheus = {
          packageName = "prometheus@0.1.1";
          members = [
            "libs/prometheus"
            "libs/utils"
          ];
        };
        blocksense-registry = {
          members = [
            "libs/registry"
          ];
        };
        blocksense-sdk = {
          members = [
            "libs/sdk"
          ];
        };
        blocksense-macro = {
          members = [
            "libs/sdk/macro"
          ];
        };
        utils = {
          members = [
            "libs/utils"
          ];
        };
      };

      oracle-scripts = mkRustPackage rec {
        crypto-price-feeds = {
          packageName = "crypto-price-feeds";
          members = [
            "apps/oracles/crypto-price-feeds"
            "libs/sdk"
          ];
        };
        exsat-holdings = {
          packageName = "exsat-holdings";
          members = [
            "apps/oracles/exsat-holdings"
            "libs/sdk"
          ];
        };
        gecko-terminal = {
          packageName = "gecko-terminal";
          members = [
            "apps/oracles/gecko-terminal"
            "libs/sdk"
          ];
        };
        cmc = {
          packageName = "cmc-oracle";
          members = [
            "libs/sdk/examples/cmc"
            "libs/sdk"
          ];
          trueCargoArtifacts = cargoArtifacts {
            pname = "cmc-cargo";
            cargoLock = ../../libs/sdk/examples/cmc/Cargo.lock;
            cargoToml = ../../libs/sdk/examples/cmc/Cargo.toml;
            sourceRootDir = "libs/sdk/examples/cmc";
          };
        };
        yahoo = {
          packageName = "yahoo-oracle";
          members = [
            "libs/sdk/examples/yahoo"
            "libs/sdk"
          ];
          trueCargoArtifacts = cargoArtifacts {
            pname = "yahoo-cargo";
            cargoLock = ../../libs/sdk/examples/yahoo/Cargo.lock;
            cargoToml = ../../libs/sdk/examples/yahoo/Cargo.toml;
            sourceRootDir = "libs/sdk/examples/yahoo";
          };
        };
        revolut = {
          packageName = "revolut-oracle";
          members = [
            "libs/sdk/examples/revolut"
            "libs/sdk"
          ];
          trueCargoArtifacts = cargoArtifacts {
            pname = "revolut-cargo";
            cargoLock = ../../libs/sdk/examples/revolut/Cargo.lock;
            cargoToml = ../../libs/sdk/examples/revolut/Cargo.toml;
            sourceRootDir = "libs/sdk/examples/revolut";
          };
        };
      };

      blocksense-rs = pkgs.symlinkJoin {
        name = "blocksense-rs";
        paths = builtins.attrValues (
          rust-packages
          // rust-libraries
          // (lib.mapAttrs' (name: value: lib.nameValuePair ("oracle-script-" + name) value) oracle-scripts)
        );
      };

      mkApp = package: exeName: {
        type = "app";
        program = "${package}/bin/${exeName}";
      };

      mkSpinStateDir = pkgs.callPackage ./spin-plugin {
        spin = lib.getExe' inputs'.nixpkgs-unstable.legacyPackages.fermyon-spin "spin";
      };
    in
    {
      apps = {
        sequencer = mkApp rust-packages.sequencer "sequencer";
        reporter = mkApp blocksense-rs "launch_reporter";
        blocksense = mkApp rust-packages.blocksense-cli "blocksense";
        trigger-oracle = mkApp rust-packages.trigger-oracle "trigger-oracle";
        blockchain_reader = mkApp pkgs.apacheKafka "kafka-console-consumer.sh";
        aggregate_consensus_reader = mkApp pkgs.apacheKafka "kafka-console-consumer.sh";
      };
      packages =
        {
          inherit blocksense-rs;
        }
        // rust-packages
        // rust-libraries
        // oracle-scripts;
      legacyPackages = {
        inherit rust-packages rust-libraries oracle-scripts;

        spinPlugins = {
          triggerOracle = mkSpinStateDir {
            name = "trigger-oracle";
            description = "Run Blocksense oracle components at timed intervals";
            homepage = "https://github.com/blocksense-network/blocksense/tree/main/apps/trigger-oracle";
            license = "Apache-2.0";
            spinCompatibility = ">=2.2";
            version = "0.1.0";
            packages = [ self'.apps.trigger-oracle.program ];
          };
        };
      };
    };
}
