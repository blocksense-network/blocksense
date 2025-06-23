use blocksense_sdk::oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings};
use blocksense_sdk::oracle_component;

#[oracle_component]
async fn oracle_request(_: Settings) -> anyhow::Result<Payload> {
    let payload = Payload {
        values: vec![DataFeedResult {
            id: "69696969".into(),
            value: DataFeedResultValue::Numerical(42.0),
        }],
    };

    Ok(payload)
}
