use dep::aztec::macros::aztec;
mod tests;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public, view}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::Serialize;
    use std::meta::derive;

    /// Max Fields that can be written in storage per Tx are 63.
    /// Thus we have blocknumber and 58 feeds that are distributed in 4 rounds.
    /// Each feed metadata has id, length of the data and the actual data => 58 * 3.
    /// Each round metadata has id and its data => 4 * 2.
    /// Thus (58 * 3) + (4 * 2) = 182.
    global MAX_FEEDS_AND_ROUNDS_DATA: u32 = 182;
    /// 2^128
    global TWO_POW_128: Field = 340282366920938463463374607431768211456;
    /// 2^115
    global TWO_POW_115: Field = 41538374868278621028243970633760768;
    /// 2^13
    global TWO_POW_13: Field = 8192;
    global TWO: Field = 2;

    #[derive(Serialize)]
    pub struct LatestRoundAndData {
        latest_round: Field,
        latest_data: Field,
    }

    #[storage]
    struct Storage<Context> {
        owner: PublicImmutable<AztecAddress, Context>,
        data_feeds: Map<Field, PublicMutable<Field, Context>, Context>,
        rounds: Map<Field, PublicMutable<Field, Context>, Context>,
        block_number: PublicMutable<u32, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
        storage.block_number.write(3); // 4 is the default block number when fetched from the Sandbox
    }

    ///                  [                                                         .                                   ]
    ///                  [  [---------]  [-----------------]  [-----------------]  .  [-------------]  [------------]  ]
    /// feed_input_data: [  | Feed id |  | the feed's data |  | the feed's data |  .  | Round index |  | Round data |  ]
    ///                  [  [---------]  [-----------------]  [-----------------]  .  [-------------]  [------------]  ]
    ///                  [                                                         .                                   ]
    ///                                      ^                  ^                                     ^
    ///                                      |                  |                                     |
    ///                                     Repeats for every feed                               Round Table
    ///
    #[public]
    fn set_feeds(
        feed_input_data: [Field; MAX_FEEDS_AND_ROUNDS_DATA],
        feeds_len: Field,
        rounds_len: Field,
        block_number: u32,
    ) {
        // TODO: Implement access control
        assert(storage.block_number.read() < block_number);
        storage.block_number.write(block_number);

        // Doing a cast here to avoid casting one more time
        let feeds_len_u64 = feeds_len as u64;
        let mut new_index: u64 = 0;
        for i in new_index..feeds_len_u64 {
            let feed_id = feed_input_data[new_index];
            let curr_feed_len = feed_input_data[new_index + 1] as u64;
            new_index = new_index + 2;

            storage.data_feeds.at(feed_id).write(feed_input_data[new_index]);

            new_index = new_index + curr_feed_len;
        }

        for i in 0..rounds_len as u64 {
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }

    #[public]
    #[view]
    fn get_latest_round(stride: Field, feed_id: Field) -> Field {
        storage.rounds.at(calculate_round_index(stride, feed_id)).read()
    }

    #[public]
    #[view]
    fn get_feed_at_round(feed_id: Field, round: Field, stride: Field) -> Field {
        storage.data_feeds.at(calculate_feed_index(feed_id, round, stride)).read()
    }

    #[public]
    #[view]
    fn get_latest_data(stride: Field, feed_id: Field) -> Field {
        storage.data_feeds.at(calculate_feed_index(feed_id, calculate_round_index(stride, feed_id), stride)).read()
    }

    #[public]
    #[view]
    fn get_latest_data_and_round(stride: Field, feed_id: Field) -> pub LatestRoundAndData {
        let latest_round = storage.rounds.at(calculate_round_index(stride, feed_id)).read();
        let latest_data = storage.data_feeds.at(calculate_feed_index(feed_id, calculate_round_index(stride, feed_id), stride)).read();

        LatestRoundAndData {
            latest_round,
            latest_data,
        }
    }

    fn calculate_feed_index(feed_id: Field, round: Field, stride: Field) -> pub Field {
        (TWO_POW_128 + (feed_id * TWO_POW_13) + round) * TWO.pow_32(stride)
    }

    fn calculate_round_index(stride: Field, feed_id: Field) -> pub Field {
        TWO_POW_115 * stride + feed_id
    }
}
