use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::prelude::AztecAddress;

use crate::tests::utils::{
    setup,
    assert_feeds_are_stored_in_correct_slots,
    assert_get_feed_at_round_produces_correct_result
};
use crate::tests::helper_vars::{
    _59_DATA_FEEDS_STRIDE_0,
    zero_feed_index,
    fifteen_feed_index,
    thirty_feed_index,
    fortyfive_feed_index,
    zero_round_index,
    one_round_index,
    two_round_index,
    three_round_index,
    calculate_feed_index,
    calculate_round_index,
};
use crate::AggregatedDataFeedStore;

#[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = setup();
    let block_number = get_block_number();
    let owner_slot = AggregatedDataFeedStore::storage_layout().owner.slot;
    let owner_storage_value: AztecAddress = storage_read(adfs_contract_address, owner_slot, block_number);
}

#[test]
unconstrained fn test_store_59_data_fields_with_length_1() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    let feeds_len = 59;
    let rounds_len = 4;

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        feeds_len,
        rounds_len,
        block_number as Field
    ).call(&mut env.public());

    let data_feeds_slot = AggregatedDataFeedStore::storage_layout().data_feeds.slot;
    let start_of_round_data = 0;

    assert_feeds_are_stored_in_correct_slots::<59>(
        data_feeds_slot,
        block_number,
        adfs_contract_address,
    );
}

#[test]
unconstrained fn test_get_feed_at_round() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    let feeds_len = 59;
    let rounds_len = 4;

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        feeds_len,
        rounds_len,
        block_number as Field
    ).call(&mut env.public());

    assert_get_feed_at_round_produces_correct_result::<59>(
        env,
        adfs_contract_address
    );
}

#[test]
unconstrained fn test_get_latest_round() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    let feeds_len = 59;
    let rounds_len = 4;

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        feeds_len,
        rounds_len,
        block_number as Field
    ).call(&mut env.public());


}
