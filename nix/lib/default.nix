lib: {
  dashToUnderscore =
    attrset:
    lib.mapAttrs' (name: value: {
      name = lib.replaceStrings [ "-" ] [ "_" ] name;
      inherit value;
    }) attrset;
}
