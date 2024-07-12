// Heavily inspired by https://stackoverflow.com/questions/51044467/how-can-i-perform-parallel-asynchronous-http-get-requests-with-reqwest.
// Comments are Original Content ™.
use futures::{stream, StreamExt};
use reqwest::Client;
use std::sync::{Arc, RwLock};
use tokio;

const CONCURRENT_REQUESTS: usize = 100;

#[tokio::main]
async fn main() {
    let num_requests: Arc<RwLock<usize>> = Arc::new(0.into());
    let num_responses: RwLock<usize> = 0.into();

    // Repeating 10 batches of 100 requests.
    for _ in 0..10 {
        let client = Client::new();

        let urls = vec!["http://127.0.0.1:8080/stress"; CONCURRENT_REQUESTS];

        // `futures::stream` will fire off requests without awaiting them; the `.for_each` later
        // will asynchronously process each response, as soon as it arrives (could be out of order)
        let bodies = stream::iter(urls)
            .map(|url| {
                let client = &client;
                // The `.clone()` is necessary, because of the `async move` on next line; not a
                // problem, because the Arc is a reference counter, so the content is not copied,
                // just the reference.
                let num_requests = num_requests.clone();
                async move {
                    // See comment on RwLock for `num_responses`.
                    *num_requests.write().unwrap() += 1;
                    let resp = client.post(url).send().await?;
                    // The request is made ...
                    resp.bytes().await
                    // ... the response is received.
                }
            })
            .buffer_unordered(CONCURRENT_REQUESTS);

        // Here, `.for_each()` processes responses as they arrive; this might be out of order,
        // thanks to `.buffer_unordered` on the previous line.
        bodies
            .for_each(|b| async {
                match b {
                    Ok(_) => {
                        // The RwLock ensures that this increment is atomic: the value is fetched,
                        // it's incremented, and stored, without allowing another task to
                        // interleave, i.e. do any of these steps in the meantime.
                        *num_responses.write().unwrap() += 1;
                    }
                    Err(e) => eprintln!("Got an error: {:?}", e),
                }
            })
            .await;
    }

    println!("#requests sent: {}", *num_requests.read().unwrap());
    println!("#successful responses: {}", *num_responses.read().unwrap());
}
