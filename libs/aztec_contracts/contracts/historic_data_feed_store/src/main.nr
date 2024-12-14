use dep::aztec::macros::aztec;

#[aztec]
contract HistoricalDataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    // Transmission's value which is 24 bytes.
    global TRANSMISSION_VALUE_BYTES_LEN: u32 = 24;
    // TODO: Have a PoC for the maximal value of the feeds that can be set in a single function call.
    global MAX_FEEDS_NUMBER: u32 = 2;
    // TODO: Research if you can increase the size to u16's max value.
    global MAX_COUNTER_PER_FEED: u16 = 255;
    global MAX_FEEDS_BYTES_LEN: u32 = MAX_FEEDS_NUMBER * TRANSMISSION_VALUE_BYTES_LEN;

    struct Transmission {
        // 24 bytes
        value: [u8; TRANSMISSION_VALUE_BYTES_LEN],
        // 64-bit number
        timestamp: Field
    }

    impl Serialize<MAX_FEEDS_NUMBER> for Transmission {
        fn serialize(self) -> [Field; MAX_FEEDS_NUMBER] {
            let mut output = [0 as Field; MAX_FEEDS_NUMBER];
            let mut bytes_value: Field = 0;
            let mut mul: Field = 1;

            for i in 0..24 {
                let temp: Field = self.value[23 - i] as Field;
                bytes_value += (temp * mul);
                mul *= 256;
            }

            output[0] = bytes_value;
            output[1] = self.timestamp;

            output
        }
    }

    impl Deserialize<MAX_FEEDS_NUMBER> for Transmission {
        fn deserialize(input: [Field; MAX_FEEDS_NUMBER]) -> Self {
            let mut value: [u8; 24] = [0; 24];

            let part_value: [u8; 24] = input[0].to_be_bytes();
            for i in 0..24 {
                value[i] = part_value[i];
            }

            Self { value, timestamp: input[1] }
        }
    }

    #[storage]
    struct Storage<Context> {
        historical_data_feeds: Map<Field, Map<Field, PublicMutable<Transmission, Context>, Context>, Context>,
        counters: Map<Field, PublicMutable<Field, Context>, Context>,
        owner: PublicImmutable<AztecAddress, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    #[public]
    fn set_feeds(
        keys: [Field; MAX_FEEDS_NUMBER],
        input_values: [u8; MAX_FEEDS_BYTES_LEN],
        length: u64
    ) {
        assert(storage.owner.read().eq(context.msg_sender()), "Caller is not the owner!");

        for i in 0..length {
            let mut counter = storage.counters.at(keys[i]).read() as u16;
            counter = (counter + 1) % MAX_COUNTER_PER_FEED;
            let mut helper_index = 0;
            let mut current_transmission_value = [0 as u8; TRANSMISSION_VALUE_BYTES_LEN];
            for j in i * TRANSMISSION_VALUE_BYTES_LEN as u64..(i + 1) * TRANSMISSION_VALUE_BYTES_LEN as u64 {
                current_transmission_value[helper_index] = input_values[j];
                helper_index += 1;
            }
            storage.historical_data_feeds.at(keys[i]).at(counter as Field).write(
                Transmission { value: current_transmission_value, timestamp: context.timestamp() as Field }
            );
            storage.counters.at(keys[i]).write(counter as Field);
        }
    }

    unconstrained fn get_data_feed(key: Field) -> pub Transmission {
        storage.historical_data_feeds.at(key).at(storage.counters.at(key).read()).read()
    }

    unconstrained fn get_latest_counter(key: Field) -> pub Field {
        storage.counters.at(key).read()
    }

    unconstrained fn get_feed_at_counter(key: Field, counter: Field) -> pub Transmission {
        storage.historical_data_feeds.at(key).at(counter).read()
    }
}
