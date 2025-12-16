{
  config,
  lib,
  ...
}:
let
  readPortsFromFile =
    path:
    let
      content = builtins.readFile path;
      lines = lib.strings.splitString "\n" content;
      nonEmpty = builtins.filter (s: s != "") lines;
      asInts = builtins.map builtins.fromJSON nonEmpty;
    in
    asInts;

  root = ../../../../..;

  availablePorts =
    let
      filePath = "${config.devenv.root}/config/generated/process-compose/e2e-wit/available-ports";
      ports = if builtins.pathExists filePath then readPortsFromFile filePath else [ ];
    in
    if builtins.length ports > 0 then ports else [ 8547 ];
  anvilInkSepoliaPort = builtins.elemAt availablePorts 0;
in
{
  imports = [
    ../general/environment-setup.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/e2e-wit";

    anvil.ink-sepolia = {
      port = anvilInkSepoliaPort;
      state = lib.mkForce "${config.devenv.root}/config/generated/process-compose/e2e-wit/anvil/state.json";
    };

    sequencer.providers.ink-sepolia = {
      publishing-criteria = lib.mkForce [
        {
          feed-id = 0; # Sports DB
          stride = 4;
          peg-to-value = 1.00;
          peg-tolerance-percentage = 10.0; # 10% tolerance assures that the price will be pegged
        }
      ];
    };

    reporters.a.api-keys = lib.mkForce { };

    oracles = lib.mkForce {
      sports-db = {
        exec-interval = 120;
        allowed-outbound-hosts = [
          "https://www.thesportsdb.com"
        ];
      };
    };
  };
}
