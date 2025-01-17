use crate::test::utils;
use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

use crate::AggregatedDataFeedStore;

#[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = utils::setup();

    // let block_number = get_block_number();
    // let admin_slot = AggregatedDataFeedStore::storage_layout().admin.slot;
    // let admin_storage_value = storage_read(adfs_contract_address, admin_slot, block_number);
    // assert(admin_storage_value == admin, "should be false");
}
