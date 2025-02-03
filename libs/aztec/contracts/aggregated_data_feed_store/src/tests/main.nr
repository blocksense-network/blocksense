use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::prelude::AztecAddress;

use crate::tests::utils;
use crate::tests::helper_vars::{_59_DATA_FEEDS_STRIDE_0, zero_feed_index};
use crate::AggregatedDataFeedStore;

#[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = utils::setup();
    let block_number = get_block_number();
    let owner_slot = AggregatedDataFeedStore::storage_layout().owner.slot;
    let owner_storage_value: AztecAddress = storage_read(adfs_contract_address, owner_slot, block_number);
    print(owner_storage_value);
}

#[test]
unconstrained fn test_store_59_data_fields_with_length_1() {
    let (env, adfs_contract_address) = utils::setup();
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
    let data_feed_first_slot = derive_storage_slot_in_map(data_feeds_slot, zero_feed_index + 1);
    let data_feed_first_slot_value: u32 = storage_read(adfs_contract_address, data_feed_first_slot, block_number);
    println("data_feed_first_slot_value");
    println(data_feed_first_slot_value);
    assert(data_feed_first_slot_value == 65136033);
}
