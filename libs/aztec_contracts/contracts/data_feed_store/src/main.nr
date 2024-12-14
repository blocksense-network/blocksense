use dep::aztec::macros::aztec;

#[aztec]
contract DataFeedStore {
    use dep::aztec::{macros::{functions::{initializer, public}, storage::storage}};
    use dep::aztec::prelude::{AztecAddress, PublicImmutable, Map, PublicMutable};

    global DATA_FEED_BYTES_LEN: u32 = 32;

    #[storage]
    struct Storage<Context> {
        data_feeds: Map<Field, PublicMutable<[Field; DATA_FEED_BYTES_LEN], Context>, Context>,
        owner: PublicImmutable<AztecAddress, Context>
    }

    #[public]
    #[initializer]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    #[public]
    fn setFeed(data: [Field; DATA_FEED_BYTES_LEN], key: Field) {
        assert(storage.owner.read().eq(context.msg_sender()), "Caller is not the owner!");
        storage.data_feeds.at(key).write(data);
    }

    unconstrained fn getFeed(key: Field) -> pub [Field; DATA_FEED_BYTES_LEN] {
        storage.data_feeds.at(key).read()
    }
}
