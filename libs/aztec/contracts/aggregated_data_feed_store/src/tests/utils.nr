use dep::aztec::{
    oracle::storage::storage_read, prelude::AztecAddress,
    protocol_types::storage::map::derive_storage_slot_in_map,
    test::helpers::test_environment::TestEnvironment,
};

use crate::AggregatedDataFeedStore;
use crate::tests::helper_vars::{
    _58_DATA_FEEDS_STRIDE_0, calculate_feed_index, one_round_index, THREE, three_round_index, TWO,
    two_round_index, ZERO, zero_round_index,
};

pub unconstrained fn setup() -> (&mut TestEnvironment, AztecAddress) {
    let mut env = TestEnvironment::new();
    let initializer_call_interface = AggregatedDataFeedStore::interface().constructor();
    let adfs_contract = env.deploy_self("AggregatedDataFeedStore").with_public_void_initializer(
        initializer_call_interface,
    );

    env.advance_block_by(1);
    (&mut env, adfs_contract.to_address())
}

pub unconstrained fn assert_feeds_are_stored_in_correct_slots(
    block_number: u32,
    adfs_contract_address: AztecAddress,
    end_of_round_data_index: u32,
) {
    let mut values_iterator = TWO;
    for i in 0..end_of_round_data_index {
        let data_feed_slot_value: u32 = storage_read(
            adfs_contract_address,
            derive_storage_slot_in_map(
                AggregatedDataFeedStore::storage_layout().data_feeds.slot,
                calculate_feed_index(i as Field, i as Field, ZERO),
            ),
            block_number,
        );
        assert(_58_DATA_FEEDS_STRIDE_0[values_iterator] as u32 == data_feed_slot_value);
        values_iterator = values_iterator + THREE;
    }
}

pub unconstrained fn assert_get_feed_at_round_produces_correct_result(
    env: &mut TestEnvironment,
    adfs_contract_address: AztecAddress,
    end_of_round_data_index: u32,
) {
    let mut values_iterator = TWO;
    let mut round_index = ZERO;
    for i in 0..end_of_round_data_index {
        round_index = __determine_round_index(round_index, i);
        let feed_at_round = AggregatedDataFeedStore::at(adfs_contract_address)
            .get_feed_at_round(i as Field, round_index, ZERO)
            .view(&mut env.public());
        println("feed_at_round");
        println(feed_at_round);
        assert(_58_DATA_FEEDS_STRIDE_0[values_iterator] == feed_at_round);
        values_iterator = values_iterator + THREE;
    }
}

unconstrained fn __determine_round_index(mut temp: Field, iterator: u32) -> Field {
    if (iterator == zero_round_index as u32) {
        temp = zero_round_index;
    } else if (iterator == one_round_index as u32) {
        temp = one_round_index;
    } else if (iterator == two_round_index as u32) {
        temp = two_round_index;
    } else if (iterator == three_round_index as u32) {
        temp = three_round_index;
    }

    temp
}
