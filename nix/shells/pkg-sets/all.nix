{
  self,
  lib,
  config,
  ...
}:
{
  imports = [
    ./js.nix
    ./rust.nix
    ./anvil.nix
    ./kafka.nix

    self.nixosModules.blocksense-process-compose
    ../../test-environments/example-setup-01.nix
  ];

  enterShell = ''
    ln -fs ${config.process.managers.process-compose.configFile} ${config.devenv.root}/process-compose.yml

    echo "VALUE: ${toString config.services.blocksense.enable}"
    # echo "TARGET: ${config.services.blocksense._sequencer-config-txt}"
    echo "VALUE: ${toString config.services.blocksense._config-dir}"
  '';
}
# ${lib.optionalString (config.services.blocksense.enable) ''
#   ln -fs ${config.services.blocksense.config-dir} ${config.devenv.root}/sequencer-config.json
# ''}
