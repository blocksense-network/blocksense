contract HistoricDataFeedStore {
    use dep::aztec::prelude::{AztecAddress, PublicImmutable, Map, PublicMutable};
    use dep::aztec::protocol_types::traits::{Serialize, Deserialize};

    // Transmission's value which is 24 bytes.
    global TRANSMISSION_VALUE_BYTES_LEN = 24;
    global MAX_FEEDS_NUMBER: u16 = 2;
    global MAX_FEEDS_BYTES_LEN = MAX_FEEDS_NUMBER * TRANSMISSION_VALUE_BYTES_LEN;

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

            for i in 1..24 {
                let temp: Field = self.value[24 - i] as Field;
                bytes_value = bytes_value + (temp * mul);
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

            let part_value = input[0].to_be_bytes(24);
            for i in 0..24 {
                value[i] = part_value[i];
            }

            Self { value, timestamp: input[1] }
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
     * Represent all values as one monolith array.
     * Using sentinel value like 0 for indexing the end
     * of the bytes in the input values.
     *
     * @note Using `current_transmission_value` as a portion
     * of the whole `input_values` array.
     *
     * @param keys The keys of each data feed, capped at MAX_FEEDS_NUMBER
     * @param input_values The values of the data feed, 24 bytes each, thus 24 * MAX_FEEDS_NUMBER bytes
     */
    #[aztec(public)]
    fn set_feeds(keys: [Field; MAX_FEEDS_NUMBER], input_values: [u8; MAX_FEEDS_BYTES_LEN], length: u64) {
        assert(storage.owner.read().eq(context.msg_sender()), "You are not the owner!");

        for i in 0..length {
            let mut counter = storage.counters.at(keys[i]).read() as u16;
            counter = (counter + 1) % MAX_FEEDS_NUMBER;
            if counter == 0 {
                counter = 1;
            }
            let mut current_transmission_value = [0 as u8; TRANSMISSION_VALUE_BYTES_LEN];
            for j in i * TRANSMISSION_VALUE_BYTES_LEN as u64..(i + 1) * TRANSMISSION_VALUE_BYTES_LEN as u64 {
                current_transmission_value[i] = input_values[j];
            }
            storage.historic_data_feeds.at(keys[i]).at(counter as Field).write(Transmission { value: current_transmission_value, timestamp: 100 + i as Field });
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

    use dep::aztec::test::{helpers::{test_environment::TestEnvironment}};
    #[test]
    fn test_historical_data_feed_store() {
        let mut env = TestEnvironment::new();
        let owner = env.create_account();
        env.impersonate(owner);
        // Deploy contract and initialize
        let initializer = HistoricDataFeedStore::interface().constructor();
        let counter_contract = env.deploy_self("HistoricDataFeedStore").with_public_initializer(initializer);
        let contract_address = counter_contract.to_address();
        env.impersonate(contract_address);
        let keys: [Field; MAX_FEEDS_NUMBER] = [0; MAX_FEEDS_NUMBER];
        let target_values: [Field; 48] = [0; 48];
        let exp_values = [
            125, 96, 176, 190, 247, 199, 141, 153,
            163, 70, 6, 106, 58, 171, 232, 33, 100,
            147, 239, 0, 117, 40, 198, 155
        ];
        let target_values = [
            125, 96, 176, 190, 247, 199, 141, 153,
            163, 70, 6, 106, 58, 171, 232, 33, 100,
            147, 239, 0, 117, 40, 198, 155,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ];
        let expected_transmission = Transmission { value: exp_values, timestamp: 100 };
        let set_feeds_interface = HistoricDataFeedStore::at(contract_address).set_feeds(keys, target_values, 2);
        env.call_public(set_feeds_interface);
        let result_transmission = get_data_feed(0);
        print(result_transmission.value);
        for i in 0..24 {
            assert(
                expected_transmission.value[i] == result_transmission.value[i], f"Expected {expected_transmission.value} but got {result_transmission.value}"
            );
        }
    }
}
