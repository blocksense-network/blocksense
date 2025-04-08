{
  self,
  config,
  ...
}:
let
  generated-cfg-dir = "$GIT_ROOT/config/generated";
in
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
    git clean -fdx -- ${generated-cfg-dir}

    ln -fs ${config.process.managers.process-compose.configFile} "${generated-cfg-dir}/process-compose.yml"

    for file in "${config.services.blocksense.config-dir}"/*; do
      ln -s "$file" "${generated-cfg-dir}/$(basename "$file")"
    done
  '';
}
