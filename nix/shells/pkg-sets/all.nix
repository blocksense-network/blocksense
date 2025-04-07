{
  config,
  pkgs,
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

  ];

  packages = [
    (pkgs.writeShellScript "process-compose" ''
      ${pkgs.lib.getExe pkgs.process-compose} -f "${generated-cfg-dir}/process-compose.yml" "$@"
    '')
  ];

  enterShell = ''
    git clean -fdx -- ${generated-cfg-dir}

    ln -fs ${config.process.managers.process-compose.configFile} "${generated-cfg-dir}/process-compose.yml"

    for file in "${config.services.blocksense.config-dir}"/*; do
      ln -s "$file" "${generated-cfg-dir}/$(basename "$file")"
    done
  '';
}
