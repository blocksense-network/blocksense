use crate::test::utils;
use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

use crate::AggregatedDataFeedStore;

#[test]
unconstrained fn test_initializer() {
    let (_, adfs_contract_address) = utils::setup();

    let block_number = get_block_number();
    let owner_slot = AggregatedDataFeedStore::storage_layout().owner.slot;
    let owner_storage_value: AztecAddress = storage_read(adfs_contract_address, owner_slot, block_number);
    print(owner_storage_value);
}
