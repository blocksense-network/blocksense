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

    min-quorum = mkOption {
      type = types.nullOr types.int;
      default = null;
      description = mdDoc "Minimum quorum of signatures before posting to Gnosis Safe contract";
    };
  };
}
