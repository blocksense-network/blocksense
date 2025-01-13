use dep::aztec::macros::aztec;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    /// TODO: 32701 is the maximal value for a fixed size array you can pass to public function with only array as a parameter
    /// TODO: Since `set_feeds` function has several parameters, each being its own type, MAX_INPUT_ARRAY_SIZE is 32700
    global MAX_INPUT_ARRAY_SIZE: u32 = 32398;
    global ROUNDS_LEN: u16 = 8192;
    global LEN_31: u32 = 31;
    global TWO: Field = 2;
    global MAX_DATA_FEED_LEN_AS_FIELDS: u32 = (MAX_INPUT_ARRAY_SIZE / LEN_31) + 1;

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
        data_feeds: Map<Field, Map<Field, PublicMutable<FeedData, Context>, Context>, Context>,
        rounds: Map<Field, PublicMutable<u16, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    #[public]
    fn set_feeds(
        feedIndex: Field,
        feed_input_data: [u8; MAX_INPUT_ARRAY_SIZE], // TODO: Can the client put `Field`s here?
        stride: u8,
        round: u16,
        length_of_data_feed: u32,
    ) {
        let stride_size: u32 = (TWO.pow_32((stride + 5) as Field)) as u32;
        assert(storage.owner.read().eq(context.msg_sender()), "Caller is not the owner!");
        assert(length_of_data_feed <= MAX_INPUT_ARRAY_SIZE, "Maximal array size of data feed exceeded!");
        assert(length_of_data_feed <= stride_size, "Stride's value isn't correct for the length of this data feed!");

        // Vector with the data feed bytes without the singleton values
        let mut data_feed_bytes: Vec<u8> = Vec::new();
        for i in 0..length_of_data_feed {
            data_feed_bytes.push(feed_input_data[i]);
        }

        let mut round = storage.rounds.at(feedIndex).read();
        round = (round + 1) % ROUNDS_LEN;

        let mut serialized_data_feed_bytes: BoundedVec<Field, MAX_DATA_FEED_LEN_AS_FIELDS> = BoundedVec::new();
        let len_of_feed_as_fields = data_feed_bytes.len() / LEN_31;
        for i in 0..len_of_feed_as_fields {
            let mut current_serialized_data_feed_bytes = [0 as u8; LEN_31];
            let mut helper_index = 0;
            for j in i * LEN_31..(i + 1) * LEN_31 {
                current_serialized_data_feed_bytes[helper_index] = data_feed_bytes.get(j);
                helper_index += 1;
            }
            serialized_data_feed_bytes.push(bytes31_to_field(current_serialized_data_feed_bytes));
        }

        // Add remaining bytes to the serialized data feed in fields
        let mut remaining_bytes: BoundedVec<u8, LEN_31 - 1> = BoundedVec::new();
        for i in (len_of_feed_as_fields * LEN_31)..length_of_data_feed - (len_of_feed_as_fields * LEN_31) {
            remaining_bytes.push(data_feed_bytes.get(i));
        }
        serialized_data_feed_bytes.push(Field::from_be_bytes::<LEN_31 - 1>(remaining_bytes.storage));

        storage.data_feeds.at(feedIndex).at(round as Field).write(
            FeedData {
                data: serialized_data_feed_bytes
            }
        );
        storage.rounds.at(feedIndex).write(round);
    }

    fn bytes31_to_field(bytes31: [u8; 31]) -> pub Field {
        let mut res_field: Field = 0;
        let mut mul: Field = 1;

        for i in 1..32 {
            let curr_byte: Field = bytes31[31 - i] as Field;
            res_field = res_field + (curr_byte * mul);
            mul *= 256;
        }

        res_field
    }
}
