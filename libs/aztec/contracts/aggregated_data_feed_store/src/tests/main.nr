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
    FIFTY_NINE,
    FOUR
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

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        FIFTY_NINE,
        FOUR,
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

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        FIFTY_NINE,
        FOUR,
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

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        FIFTY_NINE,
        FOUR,
        block_number as Field
    ).call(&mut env.public());

    assert(
        AggregatedDataFeedStore::at(adfs_contract_address)
        .get_latest_round(0, 45 as Field).view(&mut env.public()) == _59_DATA_FEEDS_STRIDE_0[_59_DATA_FEEDS_STRIDE_0.len() - 1]
    );
}

#[test]
unconstrained fn test_get_latest_data() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address).set_feeds(
        _59_DATA_FEEDS_STRIDE_0,
        FIFTY_NINE,
        FOUR,
        block_number as Field
    ).call(&mut env.public());

    let latest_data = AggregatedDataFeedStore::at(adfs_contract_address).get_latest_data(0, 45 as Field).view(&mut env.public());
    assert(latest_data == 83296120);
}
