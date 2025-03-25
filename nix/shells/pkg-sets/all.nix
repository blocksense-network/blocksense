{
  self,
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

  enterShell =
    let
      generated-config-dir = "${config.devenv.root}/config/generated";
      install-config-dir-symlink = ''
        [[ -L ${generated-config-dir} ]] && unlink ${generated-config-dir}
        ln -fs ${config.services.blocksense.config-dir} ${generated-config-dir}
      '';
    in
    ''
      ln -fs ${config.process.managers.process-compose.configFile} ${config.devenv.root}/process-compose.yml
      ${install-config-dir-symlink}
    '';
}
