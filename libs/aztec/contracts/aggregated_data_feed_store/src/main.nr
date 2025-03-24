use dep::aztec::macros::aztec;
// mod tests;

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
    global MAX_FEEDS_AND_ROUNDS_DATA: u32 = 17;
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
        debug_log("first, before assert");
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
        debug_log("testche");
        // debug_log_format("rounds_len: {0}", [rounds_len as Field]);
        for i in 0..rounds_len {
            // assert(false, feed_input_data[new_index + 1]);
            debug_log("testche");
            debug_log_format("KEYY: {0}", [feed_input_data[new_index]]);
            debug_log_format("VALUEE: {0}", [feed_input_data[new_index + 1]]);
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }


    // Underflow issue!
    // #[public]
    // #[view]
    // fn get_latest_round(stride: Field, feed_id: Field) -> Field {
    //     let id = (feed_id as u128) % 15;
    //     debug_log_format("id: {0}", [id as Field]);
    //     let row_value = (TWO_POW_115 * (stride as u128) + (feed_id as u128)) / 15;
    //     debug_log_format("row_value: {0}", [row_value as Field]);
    //     let round_value = storage.rounds.at((row_value as Field)).read();

    //     let round_value_bignum: U256 = BigNum::from(round_value);
    //     debug_log_format("round_value_bignum: [{0}], [{1}], [{2}]", [round_value_bignum.limbs[0] as Field, round_value_bignum.limbs[1] as Field, round_value_bignum.limbs[2] as Field]);
    //     let shift_factor: U256 = BigNum::from(TWO.pow_32(id as Field * 16));
    //     debug_log_format("shift_factor: [{0}], [{1}], [{2}]", [shift_factor.limbs[0] as Field, shift_factor.limbs[1] as Field, shift_factor.limbs[2] as Field]);
    //     let (shifted_value, _) = round_value_bignum.__udiv_mod(shift_factor);
    //     debug_log_format("shifted_value: [{0}], [{1}], [{2}]", [shifted_value.limbs[0] as Field, shifted_value.limbs[1] as Field, shifted_value.limbs[2] as Field]);

    //     let (sh_v_2_pow_13, _) = shifted_value.__udiv_mod(ROUND_VALUE_MAX_BITS_SIZE);
    //     let upper_bits: U256 = sh_v_2_pow_13 * ROUND_VALUE_MAX_BITS_SIZE;
    //     debug_log_format("upper_bits: [{0}], [{1}], [{2}]", [upper_bits.limbs[0] as Field, upper_bits.limbs[1] as Field, upper_bits.limbs[2] as Field]);
    //     let slot_value: U256 = sh_v_2_pow_13 - upper_bits;

    //     to_field(slot_value)
    // }

    #[public]
    #[view]
    fn get_latest_round(stride: Field, feed_id: Field) -> Field {
        let id = (feed_id as u128) % 15 + 1;
        debug_log_format("id: {0}", [id as Field]);
        let pos = 240 - (16 * id);
        debug_log_format("pos: {0}", [pos as Field]);
        let two_pow_pos = TWO.pow_32(pos as Field);
        debug_log_format("two_pow_pos: {0}", [two_pow_pos as Field]);
        let row_value = (TWO_POW_115 * (stride as u128) + (feed_id as u128)) / 15;
        debug_log_format("row_value: {0}", [row_value as Field]);
        let round_value = storage.rounds.at((row_value as Field)).read();
        debug_log_format("round_value: {0}", [round_value as Field]);
        let round_value_bignum: U256 = BigNum::from(round_value);
        debug_log_format("round_value_bignum: [{0}], [{1}], [{2}]", [round_value_bignum.limbs[0] as Field, round_value_bignum.limbs[1] as Field, round_value_bignum.limbs[2] as Field]);
        let two_pow_pos_bignum: U256 = BigNum::from(two_pow_pos);
        debug_log_format("two_pow_pos_bignum: [{0}], [{1}], [{2}]", [two_pow_pos_bignum.limbs[0] as Field, two_pow_pos_bignum.limbs[1] as Field, two_pow_pos_bignum.limbs[2] as Field]);
        let (shifted, _) = round_value_bignum.__udiv_mod(two_pow_pos_bignum);
        debug_log_format("shifted: [{0}], [{1}], [{2}]", [shifted.limbs[0] as Field, shifted.limbs[1] as Field, shifted.limbs[2] as Field]);
        let (round_q, round_r) = shifted.__udiv_mod(ROUND_VALUE_MAX_BITS_SIZE);
        debug_log_format("round_q: [{0}], [{1}], [{2}]", [round_q.limbs[0] as Field, round_q.limbs[1] as Field, round_q.limbs[2] as Field]);
        debug_log_format("round_r: [{0}], [{1}], [{2}]", [round_r.limbs[0] as Field, round_r.limbs[1] as Field, round_r.limbs[2] as Field]);

        let round_q_mul_15 = round_q * ROUND_VALUE_MAX_BITS_SIZE;
        debug_log_format("round_q_mul_15: [{0}], [{1}], [{2}]", [round_q_mul_15.limbs[0] as Field, round_q_mul_15.limbs[1] as Field, round_q_mul_15.limbs[2] as Field]);
        let round = shifted - round_q_mul_15;
        debug_log_format("round: [{0}], [{1}], [{2}]", [round.limbs[0] as Field, round.limbs[1] as Field, round.limbs[2] as Field]);

        to_field(round)
    }

    #[public]
    #[view]
    fn get_feed_at_round(feed_id: Field, round: Field, stride: Field) -> Field {
        debug_log_format("for round: {0}", [round]);
        debug_log_format("calculated feed index is: {0}", [storage.data_feeds.at(calculate_feed_index(feed_id, round, stride)).read()]);
        storage.data_feeds.at(calculate_feed_index(feed_id, round, stride)).read()
    }

    #[public]
    #[view]
    fn get_latest_data(stride: Field, feed_id: Field) -> Field {
        let latest_round = get_latest_round(stride, feed_id);
        debug_log_format("for latest_round: {0}", [latest_round]);
        debug_log_format("the latest data: {0}", [storage.data_feeds.at(calculate_feed_index(feed_id, latest_round, stride)).read()]);
        storage.data_feeds.at(calculate_feed_index(feed_id, latest_round, stride)).read()
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
