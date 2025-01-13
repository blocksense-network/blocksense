use dep::aztec::macros::aztec;

#[aztec]
contract AggregatedDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    // use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    /// 32701 is the maximal value for a fixed size array you can pass to public function with only array as a parameter
    /// TODO: FIX: Since `set_feeds` function has several parameters, each being its own type, MAX_ARRAY_SIZE is 32700
    global MAX_ARRAY_SIZE: u32 = 32398;
    global ROUNDS_LEN: u16 = 8192;
    global BYTES_31_LEN: u32 = 31;
    global MAX_FIELDS_LEN: Field = 330000000000000000000000;

    struct FeedData {
        stride: u8,
        round: u16,
        data: Vec<Field>
    }

    #[storage]
    struct Storage<Context> {
                    //   (feedId << stride + 5)  --->   FeedData
        _data_feeds_: Map<Field, PublicMutable<FeedData, Context>, Context>,
        owner: PublicImmutable<AztecAddress, Context>,
        data_feeds: Map<Field, Map<Field, PublicMutable<FeedData, Context>, Context>, Context>,
        rounds: Map<u64, PublicMutable<u16, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    #[public]
    fn __set_feeds(
        feed_input_data: [u8; MAX_ARRAY_SIZE], // TODO: Can the client put `Field`s here?
        stride: u8,
        round: u16,
        feedIndex: u64,
        length_of_data_feed: u32,
    ) {
        assert(storage.owner.read().eq(context.msg_sender()), "Caller is not the owner!");
        assert(length_of_data_feed <= MAX_ARRAY_SIZE, "Maximal array size of data feed exceeded!");

        // Vector with the data feed bytes without the singleton values
        let mut data_feed_bytes: Vec<u8> = Vec::new();
        for i in 0..length_of_data_feed { // INFO: If no length parameter, use: `0..2 ^ (stride + 5)`
            data_feed_bytes.push(feed_input_data[i]);
        }

        let mut round = storage.rounds.at(feedIndex).read();
        round = (round + 1) % ROUNDS_LEN;

        let mut serialized_data_feed_bytes: Vec<Field> = Vec::new();
        for i in 0..data_feed_bytes.len() / BYTES_31_LEN {
            let mut current_serialized_data_feed_bytes = [0 as u8; BYTES_31_LEN];
            let mut helper_index = 0;
            for j in i * BYTES_31_LEN..(i + 1) * BYTES_31_LEN {
                current_serialized_data_feed_bytes[helper_index] = data_feed_bytes.get(j);
                helper_index += 1;
            }
            serialized_data_feed_bytes.push(bytes31_to_field(current_serialized_data_feed_bytes));
        }

        // storage.data_feeds.at(feedIndex).at(round).write(
        //     FeedData {
        //         stride,
        //         round,
        //         data: serialized_data_feed_bytes
        //     }
        // );

        // storage.rounds.at() // storage.counters.at(keys[i]).write(counter as Field);
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
