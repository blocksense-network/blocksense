use blocksense_sdk::{
    oracle::{DataStream, Settings},
    oracle_component,
    spin::{
        http::{send, IntoResponse, Request, Response},
        variables,
    },
};

/// A simple Spin HTTP component.
#[oracle_component]
fn oracle_{{project-name | snake_case}}(settings: Settings) -> anyhow::Result<DataStream> {
    println!("Handling oracle with id {:?}", settings.id);

    // TODO: Implement the result of your oracle
    let body = "body".to_string();
    Ok(DataStream { body: Some(body) })
}
