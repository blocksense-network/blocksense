use dep::aztec::{
    prelude::AztecAddress,
    protocol_types::storage::map::derive_storage_slot_in_map,
    test::helpers::test_environment::TestEnvironment,
    oracle::{execution::get_block_number, storage::storage_read},
};

use crate::AggregatedDataFeedStore;
use crate::tests::helper_vars::{_59_DATA_FEEDS_STRIDE_0};

unconstrained pub fn setup() -> (&mut TestEnvironment, AztecAddress) {
    let mut env = TestEnvironment::new();
    let initializer_call_interface = AggregatedDataFeedStore::interface().constructor();
    let adfs_contract = env.deploy_self("AggregatedDataFeedStore").with_public_void_initializer(
        initializer_call_interface,
    );

    (&mut env, adfs_contract.to_address())
}

unconstrained fn helper(
    storage_slot: Field,
    key: Field,
    block_number: u32,
    adfs_contract_address: AztecAddress,
    start_of_round_data: u32,
    end_of_round_data: u32,
) {
    let mut new_index = 2;
    for i in 0..end_of_round_data {
        let data_feed_slot = derive_storage_slot_in_map(storage_slot, key + i as Field);
        let data_feed_slot_value: u32 = storage_read(adfs_contract_address, data_feed_slot, block_number);
        assert(_59_DATA_FEEDS_STRIDE_0[start_of_round_data + new_index] as u32 == data_feed_slot_value);
        new_index = new_index + 3;
    }
}
