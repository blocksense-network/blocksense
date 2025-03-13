use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::prelude::AztecAddress;

use crate::AggregatedDataFeedStore;
use crate::tests::helper_vars::{
    _58_DATA_FEEDS_STRIDE_0, calculate_round_index, calculate_slot_position, get_round_value,
    get_slot_value, MAX_FEEDS_SIZE_FOR_STRIDE_0, MAX_ROUNDS_SIZE_FOR_STRIDE_0, TWO_POW_126,
};
use crate::tests::utils::{
    assert_feeds_are_stored_in_correct_slots, assert_get_feed_at_round_produces_correct_result,
    setup,
};
use super::helper_vars::{one_round_index, three_round_index, two_round_index, zero_round_index};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

// #[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = setup();
    let block_number = get_block_number();
    println(block_number);
    let owner_slot = AggregatedDataFeedStore::storage_layout().owner.slot;
    let owner_storage_value: AztecAddress =
        storage_read(adfs_contract_address, owner_slot, block_number);
    println(owner_storage_value);
}

// #[test]
unconstrained fn test_store_58_data_fields_with_length_1() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());

    assert_feeds_are_stored_in_correct_slots(
        block_number,
        adfs_contract_address,
        MAX_FEEDS_SIZE_FOR_STRIDE_0,
    );
}

// #[test]
unconstrained fn test_get_feed_at_round() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());

    assert_get_feed_at_round_produces_correct_result(
        env,
        adfs_contract_address,
        MAX_FEEDS_SIZE_FOR_STRIDE_0,
    );
}

#[test]
unconstrained fn test_get_latest_round() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());

    // let rounds_slot_value: u32 = storage_read(
    //     adfs_contract_address,
    //     derive_storage_slot_in_map(
    //         AggregatedDataFeedStore::storage_layout().rounds.slot,
    //         two_round_index,
    //     ),
    //     block_number,
    // );

    // println("zero_round_index: ");
    // println(zero_round_index);
    // println("rounds_slot_value: ");
    // println(rounds_slot_value);
    // let rounds_slot_value: u32 = storage_read(
    //     adfs_contract_address,
    //     derive_storage_slot_in_map(
    //         AggregatedDataFeedStore::storage_layout().rounds.slot,
    //         one_round_index,
    //     ),
    //     block_number,
    // );

    // println(
    //     "=============================================================================",
    // );
    // println(
    //     "=============================================================================",
    // );

    let latest_round = AggregatedDataFeedStore::at(adfs_contract_address)
        .get_latest_round(0, 57 as Field)
        .view(&mut env.public());
    println("latest_round");
    println(latest_round);
    // println(
    //     "=============================================================================",
    // );
}

// #[test]
unconstrained fn test_get_latest_data() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());

    let latest_data = AggregatedDataFeedStore::at(adfs_contract_address)
        .get_latest_data(0, 45 as Field)
        .view(&mut env.public());
    assert(latest_data == 83296120);
}

// #[test(should_fail)]
unconstrained fn test_block_number_greater_than_previous() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number() - 1;

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());
}

// #[test(should_fail)]
unconstrained fn test_write_when_not_in_access_control() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();
    let alice = env.create_account(2);
    env.impersonate(alice);

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());
}

// #[test]
unconstrained fn test_get_latest_data_and_round() {
    let (env, adfs_contract_address) = setup();
    let block_number = get_block_number();

    AggregatedDataFeedStore::at(adfs_contract_address)
        .set_feeds(
            _58_DATA_FEEDS_STRIDE_0,
            MAX_FEEDS_SIZE_FOR_STRIDE_0,
            MAX_ROUNDS_SIZE_FOR_STRIDE_0,
            block_number,
        )
        .call(&mut env.public());

    let input_data_feed_index: Field = 45;
    let latest_round_and_data = AggregatedDataFeedStore::at(adfs_contract_address)
        .get_latest_data_and_round(0, input_data_feed_index)
        .view(&mut env.public());
    assert(latest_round_and_data.latest_round == 3);
    assert(latest_round_and_data.latest_data == 83296120);
}
