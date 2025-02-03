use dep::aztec::macros::aztec;
mod tests;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};

    /// Max Fields that can be written in storage per Tx are 63.
    /// Thus we have 59 feeds that are distributed in 4 rounds.
    /// Each feed metadata has id, length of the data and the actual data => 59 * 3.
    /// Each round metadata has id and its data => 4 * 2.
    /// Thus (59 * 3) + (4 * 2) = 185.
    global MAX_FEEDS_AND_ROUNDS_DATA: u32 = 185;
    /// 2^128
    global TWO_POW_128: Field = 340282366920938463463374607431768211456;
    /// 2^115
    global TWO_POW_115: Field = 41538374868278621028243970633760768;
    /// 2^13
    global TWO_POW_13: Field = 8192;
    global TWO: Field = 2;

    #[storage]
    struct Storage<Context> {
        owner: PublicImmutable<AztecAddress, Context>,
        data_feeds: Map<Field, PublicMutable<Field, Context>, Context>,
        rounds: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
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
        block_number: Field,
    ) {
        // TODO: Implement access control

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

        new_index = feeds_len_u64;
        for i in new_index..rounds_len as u64 {
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }

    unconstrained fn get_latest_round(stride: Field, feed_id: Field) -> pub Field {
        let latest_rounds_record = ((TWO_POW_115 * stride + feed_id) / 15);
        let quotient = latest_rounds_record / 15;
        let quot_times_15 = quotient * 15;
        latest_rounds_record - quot_times_15
    }

    unconstrained fn get_feed_at_round(stride: Field, feed_id: Field, round: Field) -> Field {
        storage.data_feeds.at((TWO_POW_128 + (feed_id * TWO_POW_13) + round) * TWO.pow_32(stride)).read()
    }

    unconstrained fn get_latest_data(stride: Field, feed_id: Field) -> Field {
        let latest_round = get_latest_round(stride, feed_id);
        get_feed_at_round(stride, feed_id, latest_round)
    }

    unconstrained fn get_latest_data_and_round(stride: Field, feed_id: Field) -> (Field, Field) {
        let latest_round = get_latest_round(stride, feed_id);

        (
            get_feed_at_round(stride, feed_id, latest_round),
            latest_round
        )
    }
}
