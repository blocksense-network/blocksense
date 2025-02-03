use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::prelude::AztecAddress;

use crate::tests::utils::{helper, setup};
use crate::tests::helper_vars::{
    _59_DATA_FEEDS_STRIDE_0,
    zero_feed_index,
    fifteen_feed_index,
    thirty_feed_index,
    fortyfive_feed_index,
};
use crate::AggregatedDataFeedStore;

#[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = setup();
    let block_number = get_block_number();
    let owner_slot = AggregatedDataFeedStore::storage_layout().owner.slot;
    let owner_storage_value: AztecAddress = storage_read(adfs_contract_address, owner_slot, block_number);
    print(owner_storage_value);
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
    let end_of_round_data = 15;
    helper(
        data_feeds_slot,
        zero_feed_index,
        block_number,
        adfs_contract_address,
        start_of_round_data,
        end_of_round_data
    );
    let start_of_round_data = 15 * 3;
    helper(
        data_feeds_slot,
        fifteen_feed_index,
        block_number,
        adfs_contract_address,
        start_of_round_data,
        end_of_round_data
    );
    let start_of_round_data = 30 * 3;
    helper(
        data_feeds_slot,
        thirty_feed_index,
        block_number,
        adfs_contract_address,
        start_of_round_data,
        end_of_round_data
    );
    let start_of_round_data = 45  * 3;
    let end_of_round_data = 14;
    helper(
        data_feeds_slot,
        fortyfive_feed_index,
        block_number,
        adfs_contract_address,
        start_of_round_data,
        end_of_round_data
    );
}
