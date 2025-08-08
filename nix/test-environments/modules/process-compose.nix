{
  config,
  ...
}:

{
  services.blocksense = {
    logsDir = config.devenv.root + "/logs/blocksense";
  };
}
