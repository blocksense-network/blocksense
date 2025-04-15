lib: rec {
  dashToUnderscore = lib.replaceStrings [ "-" ] [ "_" ];

  dashToUnderscoreAttrs = lib.mapAttrs' (
    name: value: lib.nameValuePair (dashToUnderscore name) value
  );

  dashToUnderscoreRecursive =
    attrs:
    let
      transformAttr =
        attr:
        let
          value = attrs.${attr};
        in
        {
          name = dashToUnderscore attr;
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
}
