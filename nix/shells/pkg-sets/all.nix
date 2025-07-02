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

  ];

  enterShell = ''
    git clean -fdx -- ${generated-cfg-dir}


    ls -l ${config.services.blocksense.config-dir}

    for file in "${config.services.blocksense.config-dir}"/*; do
      ln -s "$file" "${generated-cfg-dir}/$(basename "$file")"
    done
  '';
}
