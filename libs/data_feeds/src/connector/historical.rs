use ringbuf::traits::RingBuffer;
use ringbuf::{storage::Heap, HeapRb, SharedRb};

use crate::types::Timestamp;

use super::payload::Payload;

pub trait Historical {
    fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: Timestamp) {
        self.history_buffer().push_overwrite((response, timestamp));
    }

    fn history_buffer(&mut self) -> &mut SharedRb<Heap<(Box<dyn Payload>, Timestamp)>>;
}
