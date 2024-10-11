use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;

#[derive(PartialEq, Deserialize, Debug)]
struct TokPriceBad {
    millisUTC: String,
    price: String,
}

#[derive(PartialEq, Deserialize, Debug)]
struct TokPrice {
    millis_utc: u64,
    price: f64,
}

/// Parses the string received from the external dependency after one data point is fetched. Note
/// that one data point is actually an array of price points.
fn parse_external_data_point(data_point: String) -> Vec<TokPrice> {
    let value = serde_json::from_str::<Vec<TokPriceBad>>(&data_point);
    value
        .unwrap()
        .into_iter()
        .map(|tok_price_bad| TokPrice {
            millis_utc: tok_price_bad.millisUTC.parse().unwrap(),
            price: tok_price_bad.price.parse().unwrap(),
        })
        .collect()
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let data_feed = settings.data_feeds.first().unwrap();
    let url = match data_feed.data.as_str() {
        "COMED TOK" => Url::parse("https://hourlypricing.comed.com/api?type=5minutefeed")?,
        &_ => todo!(),
    };
    println!("URL - {}", url.as_str());
    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("user-agent", "*/*");
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body).expect("Our bytes should be valid utf8");
    let value = parse_external_data_point(string);

    let start = SystemTime::now();
    let since_the_epoch_s = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");
    let time_since_data = since_the_epoch_s.as_secs() - value[0].millis_utc / 1000;
    println!("Time since data: {time_since_data:?} seconds");
    let mut payload: Payload = Payload::new();
    payload.values.push(DataFeedResult {
        id: data_feed.id.clone(),
        value: DataFeedResultValue::Numerical(value[0].price),
    });
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_external_data_point_1() {
        let data_point = r#"[{"millisUTC":"1728649200000","price":"3.7"},{"millisUTC":"1728648900000","price":"4.9"}]"#;

        let value = parse_external_data_point(data_point.to_string());

        assert_eq!(
            value,
            vec![
                TokPrice {
                    millis_utc: 1728649200000,
                    price: 3.7
                },
                TokPrice {
                    millis_utc: 1728648900000,
                    price: 4.9
                }
            ]
        );
    }
}
