{
  self,
  config,
  ...
}:
{
  imports = [
    ./all.nix

    self.nixosModules.blocksense-process-compose
    ../../test-environments/example-setup-01.nix
  ];

  enterShell = ''
    ln -fs ${config.process.managers.process-compose.configFile} ${config.devenv.root}/process-compose.yml
  '';
}
