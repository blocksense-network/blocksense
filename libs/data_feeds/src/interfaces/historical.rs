use ringbuf::traits::RingBuffer;
use ringbuf::{storage::Heap, SharedRb};

use feed_registry::types::{FeedType, Timestamp};

pub trait Historical {
    fn collect_history(&mut self, response: FeedType, timestamp: Timestamp) {
        self.history_buffer().push_overwrite((response, timestamp));
    }

    fn history_buffer(&mut self) -> &mut SharedRb<Heap<(FeedType, Timestamp)>>;
}
