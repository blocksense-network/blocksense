use std::{collections::HashMap, rc::Rc, thread::sleep, time::Duration};

use data_feeds::{connector::data_feed::{dispatch, DataFeed}, types::DataFeedAPI, utils::get_env_var};

#[tokio::main]
async fn main() {

    let poll_period = 5;

    let batch_size = 3;
    let sequencer_url = get_env_var("SEQUENCER_URL");

    let mut batch_no = 0;

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<dyn DataFeed>>::new();

    loop {
        dispatch(
            sequencer_url.as_str(), 
            batch_size, 
            &mut connection_cache
        ).await;

        println!("Finished with {}-th batch..",batch_no + 1);
        batch_no += 1;

        sleep(Duration::from_secs(poll_period));
    }
}
