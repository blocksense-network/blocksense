lib: with lib; {
  options = {
    secs-since-epoch = mkOption {
      type = types.int;
      default = 0;
      description = mdDoc "Whole seconds since UNIX epoch.";
    };

    nanos-since-epoch = mkOption {
      type = types.int;
      default = 0;
      description = mdDoc "Nanosecond part of time since UNIX epoch.";
    };
  };
}
