use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::prelude::AztecAddress;

use crate::tests::utils::{assert_feeds_are_stored_in_correct_slots, setup};
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

    assert_feeds_are_stored_in_correct_slots::<59>(
        data_feeds_slot,
        block_number,
        adfs_contract_address,
    );
    // assert_feeds_are_stored_in_correct_slots::<15>(
    //     data_feeds_slot,
    //     zero_feed_index,
    //     block_number,
    //     adfs_contract_address,
    //     start_of_round_data
    // );
    // let start_of_round_data = 15 * 3;
    // assert_feeds_are_stored_in_correct_slots::<15>(
    //     data_feeds_slot,
    //     fifteen_feed_index,
    //     block_number,
    //     adfs_contract_address,
    //     start_of_round_data
    // );
    // let start_of_round_data = 30 * 3;
    // assert_feeds_are_stored_in_correct_slots::<15>(
    //     data_feeds_slot,
    //     thirty_feed_index,
    //     block_number,
    //     adfs_contract_address,
    //     start_of_round_data
    // );
    // let start_of_round_data = 45 * 3;
    // assert_feeds_are_stored_in_correct_slots::<14>(
    //     data_feeds_slot,
    //     fortyfive_feed_index,
    //     block_number,
    //     adfs_contract_address,
    //     start_of_round_data
    // );
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

    // let latest_data = AggregatedDataFeedStore::get_latest_data(0, zero_feed_index);
    let rounds_slot = AggregatedDataFeedStore::storage_layout().rounds.slot;
    let round_slot = derive_storage_slot_in_map(rounds_slot, three_round_index);
    println("zero_feed_index");
    println(zero_feed_index as u64);
    println("one_round_index");
    println(one_round_index as u64);
    println("two_round_index");
    println(two_round_index as u64);
    println("three_round_index");
    println(three_round_index as u64);
    let round_slot_value: u32 = storage_read(adfs_contract_address, round_slot, block_number);
    println("round_slot_value");
    println(round_slot_value);

    println("//");
    let feed_at_round = AggregatedDataFeedStore::at(adfs_contract_address).get_feed_at_round(8, zero_round_index, 0).view(&mut env.public());
    println("feed_at_round");
    println(feed_at_round as u32);
    println("//");

    println("//");
    // let mut temp = 0;
    // for i in 0..59 {
    //     if (i == zero_round_index as u32) {
    //         println("temp = zero_round_index");
    //         temp = zero_round_index;
    //     } else if (i == one_round_index as u32) {
    //         println("temp = one_round_index");
    //         temp = one_round_index;
    //     } else if (i == two_round_index as u32) {
    //         println("temp = two_round_index");
    //         temp = two_round_index;
    //     } else if (i == three_round_index as u32) {
    //         println("temp = three_round_index");
    //         temp = three_round_index;
    //     }
    //     println(calculate_feed_index(i as Field, temp, 0) as u32);
    //     println("//");
    // }

    let data_feeds_slot = AggregatedDataFeedStore::storage_layout().data_feeds.slot;
    let data_feed_slot = derive_storage_slot_in_map(data_feeds_slot, fifteen_feed_index + 12);
    let data_feed_slot_value: u32 = storage_read(adfs_contract_address, data_feed_slot, block_number);
    println("data_feed_slot_value");
    println(data_feed_slot_value);

    println("||||||||||||||||||||||||||");
    println("||||||||||||||||||||||||||");
    println("||||||||||||||||||||||||||");
    println("calculate_feed_index");
    // println(calculate_feed_index(27, one_round_index, 0) as u32);
}
