use url::Url;

use crate::config::BlocksenseConfig;

static SEQUENCER: &str = "http://gpu-server-001:8877";
static CONFIG_PATH: &str = "registry";

#[derive(Debug)]
pub struct Registry;

impl Registry {
    pub async fn get_config() -> anyhow::Result<BlocksenseConfig> {
        let sequencer_url = Url::parse(SEQUENCER).expect("hardcoded URL is known to be valid");
        let _config_path = sequencer_url.join(CONFIG_PATH)?;
        let _client = reqwest::Client::new();
        // TODO(adikov): Get the configuration from the sequencer when the implementation is
        // finished.
        // let contents = client.get(config_path).send().await?;
        // let contents = contents.text().await?;
        // tracing::trace!("Sequencer responded with: {}", &contents);

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
