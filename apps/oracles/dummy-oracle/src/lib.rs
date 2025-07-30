use blocksense_sdk::oracle_component;
use blocksense_sdk::{
    http::http_get_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
};

async fn fetch_unix_time() -> anyhow::Result<u64> {
    http_get_json("http://127.0.0.1:8080/system/time", None, None).await
}

#[oracle_component]
async fn oracle_request(_: Settings) -> anyhow::Result<Payload> {
    let report_value = match fetch_unix_time().await {
        Ok(unix_time) => DataFeedResultValue::Numerical(unix_time as f64 + 0.485), // TODO: remove this magic constant for testing
        Err(err) => DataFeedResultValue::Error(err.to_string()),
    };

    let payload = Payload {
        values: vec![DataFeedResult {
            id: "69696969".into(),
            value: report_value,
        }],
    };

    println!("dummy-oracle reporting {payload:?}");

    Ok(payload)
}
