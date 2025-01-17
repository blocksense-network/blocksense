use dep::aztec::macros::aztec;
mod test;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    /// As of aztec version `0.67.0` and compiler version `0.35.0`, 32701 is the maximal value
    /// for a fixed size array you can pass to public function with only array as a parameter.
    /// Since `set_feeds` function has several parameters, each being its own type, MAX_INPUT_ARRAY_SIZE is 32698
    global MAX_INPUT_ARRAY_SIZE: u32 = 32698;
    global MAX_DATA_FEED_LEN_AS_FIELDS: u32 = (MAX_INPUT_ARRAY_SIZE / 31) + 1;

    struct FeedData {
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

    #[storage]
    struct Storage<Context> {
        owner: PublicImmutable<AztecAddress, Context>,
        data_feeds: Map<Field, PublicMutable<FeedData, Context>, Context>,
        rounds: Map<Field, PublicMutable<u16, Context>, Context>,
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
        feed_input_data: [Field; MAX_INPUT_ARRAY_SIZE],
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
            storage.rounds.at(feed_input_data[new_index]).write(feed_input_data[new_index + 1] as u16);
            new_index = new_index + 2;
        }
    }
}
