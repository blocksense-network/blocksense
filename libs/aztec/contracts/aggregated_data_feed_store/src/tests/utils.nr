use dep::aztec::{
    prelude::AztecAddress,
    protocol_types::storage::map::derive_storage_slot_in_map,
    test::helpers::test_environment::TestEnvironment,
};

use crate::AggregatedDataFeedStore;

unconstrained pub fn setup() -> (&mut TestEnvironment, AztecAddress) {
    let mut env = TestEnvironment::new();
    let initializer_call_interface = AggregatedDataFeedStore::interface().constructor();
    let adfs_contract = env.deploy_self("AggregatedDataFeedStore").with_public_void_initializer(
        initializer_call_interface,
    );

    (&mut env, adfs_contract.to_address())
}
