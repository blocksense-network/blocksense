{
  lib,
  ...
}:
let

  root = ../..;

  testKeysDir = lib.path.append root "./nix/test-environments/test-keys";

in
{
  imports = [
    ./example-setup-01.nix
  ];

  services.blocksense = {
    logsDir = lib.mkForce "$GIT_ROOT/logs/process-compose/test-setup";

    reporters = {
      a = {
        api-keys = lib.mkForce {
          ALPHAVANTAGE_API_KEY = "${testKeysDir}/ALPHAVANTAGE_API_KEY";
          APCA_API_KEY_ID = "${testKeysDir}/APCA_API_KEY_ID";
          APCA_API_SECRET_KEY = "${testKeysDir}/APCA_API_SECRET_KEY";
          YAHOO_FINANCE_API_KEY = "${testKeysDir}/YAHOO_FINANCE_API_KEY";
          TWELVEDATA_API_KEY = "${testKeysDir}/TWELVEDATA_API_KEY";
          FMP_API_KEY = "${testKeysDir}/FMP_API_KEY";
          SPOUT_RWA_API_KEY = "${testKeysDir}/SPOUT_RWA_API_KEY";
        };
      };
    };

  };
}
