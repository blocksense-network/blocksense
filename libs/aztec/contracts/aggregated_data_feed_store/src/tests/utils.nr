use dep::aztec::{
    prelude::AztecAddress,
    protocol_types::storage::map::derive_storage_slot_in_map,
    test::helpers::test_environment::TestEnvironment,
    oracle::{execution::get_block_number, storage::storage_read},
};

use crate::AggregatedDataFeedStore;
use crate::tests::helper_vars::{_59_DATA_FEEDS_STRIDE_0, calculate_feed_index, zero_round_index, one_round_index, two_round_index, three_round_index};

unconstrained pub fn setup() -> (&mut TestEnvironment, AztecAddress) {
    let mut env = TestEnvironment::new();
    let initializer_call_interface = AggregatedDataFeedStore::interface().constructor();
    let adfs_contract = env.deploy_self("AggregatedDataFeedStore").with_public_void_initializer(
        initializer_call_interface,
    );

    env.advance_block_by(1);
    (&mut env, adfs_contract.to_address())
}

unconstrained fn assert_feeds_are_stored_in_correct_slots<let N: u32>(
    storage_slot: Field,
    block_number: u32,
    adfs_contract_address: AztecAddress,
) {
    let mut new_index = 2;
    let mut temp = 0;
    for i in 0..N {
        if (i == zero_round_index as u32) {
            temp = zero_round_index;
        } else if (i == one_round_index as u32) {
            temp = one_round_index;
        } else if (i == two_round_index as u32) {
            temp = two_round_index;
        } else if (i == three_round_index as u32) {
            temp = three_round_index;
        }
        let data_feed_slot = derive_storage_slot_in_map(storage_slot, calculate_feed_index(i as Field, temp ,0));
        let data_feed_slot_value: u32 = storage_read(adfs_contract_address, data_feed_slot, block_number);
        assert(_59_DATA_FEEDS_STRIDE_0[new_index] as u32 == data_feed_slot_value);
        new_index = new_index + 3;
    }
}
