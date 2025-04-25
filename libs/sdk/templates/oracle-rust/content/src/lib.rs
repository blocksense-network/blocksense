use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::{
        http::{send, Method, IntoResponse, Request, Response},
        variables,
    },
};

/// A simple Spin HTTP component.
#[oracle_component]
fn oracle_{{project-name | snake_case}}(settings: Settings) -> anyhow::Result<Payload> {
    println!("Handling oracle with id {:?}", settings.data_feeds);

    // TODO: Implement the result of your oracle
    let id = "id".to_string();
    let value = 0.0;
    let mut payload: Payload = Payload::new();
    payload.values.push(DataFeedResult {
        id,
        value: DataFeedResultValue::Numerical(value),
    });
    Ok(payload)
}
