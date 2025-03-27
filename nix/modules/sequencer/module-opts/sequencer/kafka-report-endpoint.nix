lib: with lib; {
  options = {
    url = mkOption {
      type = types.nullOr types.str;
      description = mdDoc "The URL of the Apache Kafka server.";
    };
  };
}
