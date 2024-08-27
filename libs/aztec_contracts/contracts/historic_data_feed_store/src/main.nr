contract HistoricDataFeedStore {
    use dep::aztec::prelude::{AztecAddress, PublicImmutable, Map, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    // Transmission's value which is 32 bytes.
    global TRANSMISSION_VALUE_BYTES_LEN = 32;
    /**
     * Timestamp is 7 bytes but its value is
     * serialized as one field element, thus
     * Transmission's value + timestamp value.
     */
    global TRANSMISSION_BYTES_LEN = TRANSMISSION_VALUE_BYTES_LEN + 1;
    global MAX_FEEDS_NUMBER: u16 = 7;
    global MAX_FEEDS_BYTES_LEN = MAX_FEEDS_NUMBER * TRANSMISSION_VALUE_BYTES_LEN;

    struct Transmission {
        // 32 bytes
        value: [Field; TRANSMISSION_VALUE_BYTES_LEN],
        // 64-bit number
        timestamp: Field
    }

    impl Serialize<TRANSMISSION_BYTES_LEN> for Transmission {
        fn serialize(self) -> [Field; TRANSMISSION_BYTES_LEN] {
            let mut output = [0; TRANSMISSION_BYTES_LEN];

            output[0] = self.timestamp;

            for i in 0..TRANSMISSION_VALUE_BYTES_LEN {
                output[i+1] = self.value[i];
            }
            output
        }
    }

    impl Deserialize<TRANSMISSION_BYTES_LEN> for Transmission {
        fn deserialize(input: [Field; TRANSMISSION_BYTES_LEN]) -> Self {
            let timestamp = input[0];
            let mut value = [0; TRANSMISSION_VALUE_BYTES_LEN];
            for i in 0..TRANSMISSION_VALUE_BYTES_LEN {
                value[i] = input[i+1];
            }

            Self { value, timestamp }
        }
    }

    #[aztec(storage)]
    struct Storage {
        historic_data_feeds: Map<Field, Map<Field, PublicMutable<Transmission>>>,
        counters: Map<Field, PublicMutable<Field>>,
        owner: PublicImmutable<AztecAddress>
    }

    #[aztec(public)]
    #[aztec(initializer)]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    /**
     * Sets a historical data feed
     * 
     * Represent all values as one monolith array since
     * nested arrays are not supported in Noir.
     * Using sentinel value like 0 for indexing the end
     * of the bytes in the input values.
     *
     * @note Using `current_transmission_value` as a portion
     * of the whole `input_values` array.
     *
     * @param keys The keys of each data feed, capped at 7
     * @param input_values The values of the data feed, 32 bytes each, thus 32 * 7 bytes
     */
    #[aztec(public)]
    fn set_feeds(keys: [Field; MAX_FEEDS_NUMBER], input_values: [Field; MAX_FEEDS_BYTES_LEN], length: u64) {
        assert(storage.owner.read().eq(context.msg_sender()), "You are not the owner!");

        for i in 0..length {
            let mut counter = storage.counters.at(keys[i]).read() as u16;
            counter = (counter + 1) % MAX_FEEDS_NUMBER;
            if counter == 0 {
                counter = 1;
            }
            let mut current_transmission_value = [0; TRANSMISSION_VALUE_BYTES_LEN];
            for j in i * TRANSMISSION_VALUE_BYTES_LEN as u64..(i + 1) * TRANSMISSION_VALUE_BYTES_LEN as u64 {
                current_transmission_value[i] = input_values[j];
            }
            storage.historic_data_feeds.at(keys[i]).at(counter as Field).write(
                Transmission { value: current_transmission_value, timestamp: context.timestamp() as Field }
            );
            storage.counters.at(keys[i]).write(counter as Field);
        }
    }

    unconstrained fn get_data_feed(key: Field) -> pub Transmission {
        storage.historic_data_feeds.at(key).at(storage.counters.at(key).read()).read()
    }

    unconstrained fn get_latest_counter(key: Field) -> pub Field {
        storage.counters.at(key).read()
    }

    unconstrained fn get_feed_at_counter(key: Field, counter: Field) -> pub Transmission {
        storage.historic_data_feeds.at(key).at(counter).read()
    }
}
