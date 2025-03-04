use dep::aztec::macros::aztec;
mod tests;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::macros::{functions::{initializer, public, view}, storage::storage};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Deserialize, Serialize};
    use std::meta::derive;

    /// Max Fields that can be written in storage per Tx are 63.
    /// Thus we have blocknumber and 58 feeds that are distributed in 4 rounds.
    /// Each feed metadata has id, length of the data and the actual data => 58 * 3.
    /// Each round metadata has id and its data => 4 * 2.
    /// Thus (58 * 3) + (4 * 2) = 182.
    global MAX_FEEDS_AND_ROUNDS_DATA: u32 = 182;
    global TWO: Field = 2;
    global MAX_ROUND_VALUES_IN_A_FIELD: Field = 15;
    global ROUND_SIZE_IN_BITS: Field = 16;
    global ROUNDS_MAX_SIZE: Field = 8192; // 2^13
    global ROUND_VALUE_MAX_BITS_SIZE: Field = 65536; // 2^16
    global ROUND_TABLE_SCALAR_VALUE: Field = 41538374868278621028243970633760768; // 2^115
    global FEED_INDEX_SCALAR_VALUE: Field = 340282366920938463463374607431768211456; // 2^128

    #[derive(Serialize, Deserialize)]
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

    ///                  [                                                                  .                                   ]
    ///                  [  [------------------]  [-----------------]  [-----------------]  .  [-------------]  [------------]  ]
    /// feed_input_data: [  | Feed computed id |  | the feed's len  |  | the feed's data |  .  | Round index |  | Round data |  ]
    ///                  [  [------------------]  [-----------------]  [-----------------]  .  [-------------]  [------------]  ]
    ///                  [                                                                  .                                   ]
    ///                                          ^                  ^                                         ^
    ///                                          |                  |                                         |
    ///                                         Repeats for every feed                                   Round Table
    ///
    #[public]
    fn set_feeds(
        feed_input_data: [Field; MAX_FEEDS_AND_ROUNDS_DATA],
        feeds_len: u32,
        rounds_len: u32,
        block_number: u32,
    ) {
        assert(context.msg_sender() == storage.owner.read());
        assert(storage.block_number.read() < block_number);
        storage.block_number.write(block_number);

        let mut new_index: u32 = 0;
        for i in new_index..feeds_len {
            let feed_computed_index = feed_input_data[new_index];
            let curr_feed_len = feed_input_data[new_index + 1] as u32;
            new_index = new_index + 2;

            storage.data_feeds.at(feed_computed_index).write(feed_input_data[new_index]);

            new_index = new_index + curr_feed_len;
        }

        for i in 0..rounds_len {
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }

    #[public]
    #[view]
    fn get_latest_round(stride: Field, feed_id: Field) -> Field {
        let round_index = calculate_round_index(stride, feed_id);
        let slot_position = calculate_slot_position(feed_id);
        let round_value = storage.rounds.at(round_index).read();

        get_slot_value(round_value, slot_position)
    }

    #[public]
    #[view]
    fn get_feed_at_round(feed_id: Field, round: Field, stride: Field) -> Field {
        storage.data_feeds.at(calculate_feed_index(feed_id, round, stride)).read()
    }

    #[public]
    #[view]
    fn get_latest_data(stride: Field, feed_id: Field) -> Field {
        storage
            .data_feeds
            .at(calculate_feed_index(feed_id, get_latest_round(stride, feed_id), stride))
            .read()
    }

    #[public]
    #[view]
    fn get_latest_data_and_round(stride: Field, feed_id: Field) -> pub LatestRoundAndData {
        LatestRoundAndData {
            latest_round: get_latest_round(stride, feed_id),
            latest_data: storage
                .data_feeds
                .at(calculate_feed_index(feed_id, get_latest_round(stride, feed_id), stride))
                .read(),
        }
    }

    fn calculate_feed_index(feed_id: Field, round: Field, stride: Field) -> pub Field {
        (FEED_INDEX_SCALAR_VALUE + (feed_id * ROUNDS_MAX_SIZE) + round) * TWO.pow_32(stride)
    }

    fn calculate_round_index(stride: Field, feed_id: Field) -> pub Field {
        ((ROUND_TABLE_SCALAR_VALUE * stride) + feed_id) / MAX_ROUND_VALUES_IN_A_FIELD
    }

    fn calculate_slot_position(feed_id: Field) -> pub Field {
        let quotient = feed_id / MAX_ROUND_VALUES_IN_A_FIELD;
        let remainder = feed_id - (quotient * MAX_ROUND_VALUES_IN_A_FIELD);

        remainder
    }

    fn get_slot_value(row_value: Field, slot_index: Field) -> pub Field {
        let shift_factor = TWO.pow_32(slot_index * ROUND_SIZE_IN_BITS);
        let shifted_value = row_value / shift_factor;

        let upper_bits = (shifted_value / ROUND_VALUE_MAX_BITS_SIZE) * ROUND_VALUE_MAX_BITS_SIZE;
        let slot_value = shifted_value - upper_bits;

        slot_value
    }
}
