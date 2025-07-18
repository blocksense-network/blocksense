lib: with lib; {
  options = {
    name = mkOption {
      type = types.str;
      default = "";
      description = mdDoc "Name of the contract";
    };

    address = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = mdDoc "Address of the contract";
    };

    creation-byte-code = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = mdDoc "";
    };

    deployed-byte-code = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = mdDoc "";
    };

    contract-version = mkOption {
      type = types.int;
      default = 1;
      description = mdDoc "";
    };
  };
}
