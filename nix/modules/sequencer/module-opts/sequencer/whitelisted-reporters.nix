lib: with lib; {
  options = {
    id = mkOption {
      type = types.int;
      description = mdDoc "Consecutive ids of the reporters.";
    };

    pub-key = mkOption {
      type = types.str;
      description = mdDoc "BLS public key of the reporter.";
    };

    address = mkOption {
      type = types.str;
      description = mdDoc "Gnosis Safe address of the reporter.";
    };
  };
}
