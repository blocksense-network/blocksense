use dep::aztec::macros::aztec;
mod tests;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::macros::{functions::{initializer, public, view}, storage::storage};
    use dep::aztec::oracle::debug_log::debug_log;
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::{debug_log::debug_log_format, traits::{Deserialize, Serialize}};
    use bignum::{BigNum, BigNumTrait}; // BigNumTrait is imported to silence `from_slice` warnings.
    use bignum::bignum::to_field;
    use bignum::fields::U256::U256Params;
    use std::meta::derive;

    // Define (compile-time) BigNum type
    // number of limbs, number of bits of modulus, parameter set
    // This way of definition is compatible with bignum version v0.5.2
    // Newer versions doesn't require defining explicit field type like in this case.
    type U256 = BigNum<3, 257, U256Params>;

    /// Max Fields that can be written in storage per Tx are 63.
    /// Thus we have blocknumber and 58 feeds that are distributed in 4 rounds.
    /// Each feed metadata has id, length of the data and the actual data => 58 * 3.
    /// Each round metadata has id and its data => 4 * 2.
    /// Thus (58 * 3) + (4 * 2) = 182.
    global MAX_FEEDS_AND_ROUNDS_DATA: u32 = 182;
    global TWO: Field = 2;
    global MAX_ROUND_VALUES_IN_A_FIELD: U256 = BigNum::from_slice([15, 0, 0]);
    global ROUND_SIZE_IN_BITS: U256 = BigNum::from_slice([16, 0, 0]);
    global ROUNDS_MAX_SIZE: Field = 8192; // 2^13
    global TWO_POW_115: u128 = 41538374868278621028243970633760768;
    global ROUND_VALUE_MAX_BITS_SIZE: U256 = BigNum::from_slice([65536, 0, 0]); // 2^16
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
        // debug_log("first, before assert");
        assert(context.msg_sender() == storage.owner.read());
        assert(storage.block_number.read() < block_number);
        storage.block_number.write(block_number);

        // debug_log("write storage slots for data feeds");
        let mut new_index: u32 = 0;
        for i in new_index..feeds_len {
            let feed_computed_index = feed_input_data[new_index];
            let curr_feed_len = feed_input_data[new_index + 1] as u32;
            new_index = new_index + 2;

            storage.data_feeds.at(feed_computed_index).write(feed_input_data[new_index]);

            new_index = new_index + curr_feed_len;
        }
        // debug_log("finish writing storage slots for data feeds");

        // debug_log_format("rounds_len: {0}", [rounds_len as Field]);
        for i in 0..rounds_len {
            // assert(false, feed_input_data[new_index + 1]);
            // debug_log("test");
            // debug_log_format("KEYY: {0}", [feed_input_data[new_index]]);
            // debug_log_format("VALUEE: {0}", [feed_input_data[new_index + 1]]);
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }

    #[public]
    #[view]
    fn get_latest_round(stride: Field, feed_id: Field) -> Field {
        let id = (feed_id as u128) % 15;
        let pos = 240 - (16 * id);
        let two_pow_pos = TWO.pow_32(pos as Field);
        let row_value = (TWO_POW_115 * (stride as u128) + (feed_id as u128)) / 15;
        let round_value = storage.rounds.at((row_value as Field)).read();
        let round_value_bignum: U256 = BigNum::from(round_value);
        let two_pow_pos_bignum: U256 = BigNum::from(two_pow_pos);
        let (shifted, _) = round_value_bignum.__udiv_mod(two_pow_pos_bignum);
        let (_, round) = shifted.__udiv_mod(ROUND_VALUE_MAX_BITS_SIZE);

        to_field(round)
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
}
