use std::{
    collections::HashMap,
    rc::Rc,
    thread::sleep,
    time::{Duration, Instant},
};

use data_feeds::{
    connector::data_feed::{dispatch, DataFeed},
    types::DataFeedAPI,
    utils::get_env_var,
};

#[tokio::main]
async fn main() {
    let poll_period = 5;
    let batch_size = 3;

    let sequencer_url = get_env_var("SEQUENCER_URL");
    let poll_period_ms = get_env_var("POLL_PERIOD_MS").parse::<u64>().unwrap();

    let mut batch_no = 0;

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<dyn DataFeed>>::new();

    loop {
        let start_time = Instant::now();

        dispatch(sequencer_url.as_str(), batch_size, &mut connection_cache).await;

        println!("Finished with {}-th batch..", batch_no + 1);
        batch_no += 1;

        let elapsed_time = start_time.elapsed().as_millis();
        if elapsed_time < poll_period_ms.into() {
            let remaining_time_ms = poll_period_ms - (elapsed_time as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }
    }
}
