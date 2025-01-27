use dep::aztec::macros::aztec;
mod test;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    comptime global TWO_POW_128: Field = 340282366920938463463374607431768211456; // 2^128
    comptime global TWO_POW_13: Field = 8192; // 2^13
    comptime global TWO_POW_115: Field = 41538374868278621028243970633760768; // 2^115
    comptime global TWO: Field = 2;

    /// As of aztec version `0.67.0` and compiler version `0.35.0`, 32701 is the maximal value
    /// for a fixed size array you can pass to public function with only array as a parameter.
    /// Since `set_feeds` function has several parameters, each being its own type, MAX_INPUT_ARRAY_SIZE is 32698
    global MAX_INPUT_ARRAY_SIZE: u32 = 1000;
    global MAX_DATA_FEED_LEN_AS_FIELDS: u32 = (MAX_INPUT_ARRAY_SIZE / 31) + 1;

    /// TODO: When aztec-nr's storage macro start handling field types with generics implement `FeedData` with generic param
    struct FeedData {
        // TODO: Check gas difference between one len array and N len array
        data: BoundedVec<Field, MAX_DATA_FEED_LEN_AS_FIELDS>
    }

    impl Serialize<MAX_DATA_FEED_LEN_AS_FIELDS> for FeedData {
        fn serialize(self) -> [Field; MAX_DATA_FEED_LEN_AS_FIELDS] {
            self.data.storage
        }
    }

    impl Deserialize<MAX_DATA_FEED_LEN_AS_FIELDS> for FeedData {
        fn deserialize(input: [Field; MAX_DATA_FEED_LEN_AS_FIELDS]) -> Self {
            Self {
                data: BoundedVec::from_array(input)
            }
        }
    }

    /// As aztec-nr smart contract's storage still doesn't handle field types with generics
    /// the FeedData struct comes with the max size of fields that can be written for certain data feed.
    #[storage]
    struct Storage<Context> {
        owner: PublicImmutable<AztecAddress, Context>,
        data_feeds: Map<Field, PublicMutable<FeedData, Context>, Context>,
        rounds: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    ///                  [                                                           .                                   ]
    ///                  [  [---------]  [-------------------]  [-----------------]  .  [-------------]  [------------]  ]
    /// feed_input_data: [  | Feed id |  | the feed's length |  | the feed's data |  .  | Round index |  | Round data |  ]
    ///                  [  [---------]  [-------------------]  [-----------------]  .  [-------------]  [------------]  ]
    ///                  [                                                           .                                   ]
    ///
    ///                                ^               ^               ^                                ^
    ///                                |               |               |                                |
    ///                           Each feed this metadata and this part repeats                    Round Table
    ///                           as many times as there are feeds in the array
    #[public]
    fn set_feeds(
        feed_input_data: [Field; MAX_DATA_FEED_LEN_AS_FIELDS],
        block_number: Field,
        feeds_len: Field,
        rounds_len: Field
    ) {
        // TODO: Implement access control

        // Doing a cast here to avoid casting one more time
        let feeds_len_u64 = feeds_len as u64;
        let mut new_index: u64 = 0;
        for i in new_index..feeds_len_u64 {
            let feed_id = feed_input_data[new_index];
            let curr_feed_len = feed_input_data[new_index + 1] as u64;
            new_index = new_index + 2;

            let mut data: BoundedVec<Field, MAX_DATA_FEED_LEN_AS_FIELDS> = BoundedVec::new();
            for j in 0..curr_feed_len {
                data.push(feed_input_data[new_index + j]);
            }
            storage.data_feeds.at(feed_id).write(
                FeedData {
                    data
                }
            );

            new_index = new_index + curr_feed_len;
        }

        new_index = feeds_len_u64;
        for i in new_index..rounds_len as u64 {
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1]);
            new_index = new_index + 2;
        }
    }

    unconstrained fn get_data(stride: Field, feed_id: Field, start_slot: Field, slots: Field, round: Field) -> pub FeedData {
        storage.data_feeds.at(TWO_POW_128.pow_32(stride) + ((feed_id * TWO_POW_13) * TWO.pow_32(stride)) + (round * TWO.pow_32(stride))).read()
    }

    unconstrained fn get_latest_round(stride: Field, feed_id: Field) -> pub Field {
        let latest_rounds_record = ((TWO_POW_115 * stride + feed_id) / 15);
        let quotient = latest_rounds_record / 15;
        let quot_times_15 = quotient * 15;
        latest_rounds_record - quot_times_15
    }
}
