lib: rec {
  dashToUnderscore =
    attrset:
    lib.mapAttrs' (name: value: {
      name = lib.replaceStrings [ "-" ] [ "_" ] name;
      inherit value;
    }) attrset;

  dashToUnderscoreRecursive =
    attrs:
    let
      transformAttr =
        attr:
        let
          value = attrs.${attr};
        in
        {
          name = lib.replaceStrings [ "-" ] [ "_" ] attr;
          value =
            if builtins.isAttrs value then
              dashToUnderscoreRecursive value
            else if builtins.isList value then
              map (el: if builtins.isAttrs el then dashToUnderscoreRecursive el else el) value
            else
              value;
        };
    in
    builtins.listToAttrs (map transformAttr (builtins.attrNames attrs));

  getReporterConfigFilename = name: "reporter_config_${name}";
}
