contract DataFeedStore {
    use dep::aztec::prelude::{AztecAddress, PublicImmutable, Map, PublicMutable};

    global DATA_FEED_BYTES_LEN = 32;

    #[aztec(storage)]
    struct Storage {
        data_feeds: Map<Field, PublicMutable<[Field; DATA_FEED_BYTES_LEN]>>,
        owner: PublicImmutable<AztecAddress>
    }

    #[aztec(public)]
    #[aztec(initializer)]
    fn constructor() {
        storage.owner.initialize(context.msg_sender());
    }

    #[aztec(public)]
    fn setFeed(data: [Field; DATA_FEED_BYTES_LEN], key: Field) {
        assert(storage.owner.read().eq(context.msg_sender()), "Caller is not the owner!");
        storage.data_feeds.at(key).write(data);
    }

    unconstrained fn getFeed(key: Field) -> pub [Field; DATA_FEED_BYTES_LEN] {
        storage.data_feeds.at(key).read()
    }
}
