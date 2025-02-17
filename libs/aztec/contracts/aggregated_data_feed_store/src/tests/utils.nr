use dep::aztec::{
    prelude::AztecAddress,
    protocol_types::storage::map::derive_storage_slot_in_map,
    test::helpers::test_environment::TestEnvironment,
    oracle::{execution::get_block_number, storage::storage_read},
};

use crate::AggregatedDataFeedStore;
use crate::tests::helper_vars::{_59_DATA_FEEDS_STRIDE_0, calculate_feed_index, zero_round_index, one_round_index, two_round_index, three_round_index, ZERO, ONE, TWO, THREE};

unconstrained pub fn setup() -> (&mut TestEnvironment, AztecAddress) {
    let mut env = TestEnvironment::new();
    let initializer_call_interface = AggregatedDataFeedStore::interface().constructor();
    let adfs_contract = env.deploy_self("AggregatedDataFeedStore").with_public_void_initializer(
        initializer_call_interface,
    );

    env.advance_block_by(1);
    (&mut env, adfs_contract.to_address())
}

unconstrained fn assert_feeds_are_stored_in_correct_slots<let END_OF_ROUND_DATA: u32>(
    storage_slot: Field,
    block_number: u32,
    adfs_contract_address: AztecAddress,
) {
    let mut values_iterator = TWO;
    let mut round_index = ZERO;
    for i in 0..END_OF_ROUND_DATA {
        round_index = __determine_round_index(round_index, i);
        let data_feed_slot = derive_storage_slot_in_map(storage_slot, calculate_feed_index(i as Field, round_index, ZERO));
        let data_feed_slot_value: u32 = storage_read(adfs_contract_address, data_feed_slot, block_number);
        assert(_59_DATA_FEEDS_STRIDE_0[values_iterator] as u32 == data_feed_slot_value);
        values_iterator = values_iterator + THREE;
    }
}

unconstrained fn assert_get_feed_at_round_produces_correct_result<let END_OF_ROUND_DATA: u32>(
    env: &mut TestEnvironment,
    adfs_contract_address: AztecAddress
) {
    let mut values_iterator = TWO;
    let mut round_index = ZERO;
    for i in 0..END_OF_ROUND_DATA {
        round_index = __determine_round_index(round_index, i);
        let feed_at_round = AggregatedDataFeedStore::at(adfs_contract_address).get_feed_at_round(i as Field, round_index, ZERO).view(&mut env.public());
        assert(_59_DATA_FEEDS_STRIDE_0[values_iterator] == feed_at_round);
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
