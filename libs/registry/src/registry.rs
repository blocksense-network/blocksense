use crate::config::BlocksenseConfig;

#[derive(Debug)]
pub struct Registry;

impl Registry {
    pub async fn get_config() -> anyhow::Result<BlocksenseConfig> {
        // TODO(adikov): Get the configuration from the sequencer when the implementation is
        let json = r#"
        {
          "oracles": [{
            "id": "revolut-example",
            "oracle_script_wasm": "revolut-example.wasm",
            "data_feeds": [{
                "id": "USD/BTC",
                "interval": 10
              }, {
                "id": "USD/ETH",
                "interval": 15
            }]
          }],
          "capabilities": []
        }
            "#;
        let config: BlocksenseConfig = serde_json::from_str(json).expect("Failed to parse json.");
        Ok(config)
    }
}
