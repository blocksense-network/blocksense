use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

/// Wrapper for UnboundedSender that tracks message count.
#[derive(Clone)]
pub struct CountedSender<T> {
    sender: UnboundedSender<T>,
    count: Arc<AtomicUsize>,
}

/// Wrapper for UnboundedReceiver that tracks message count.
pub struct CountedReceiver<T> {
    receiver: UnboundedReceiver<T>,
    count: Arc<AtomicUsize>,
}

/// Creates a new counted unbounded channel.
pub fn counted_unbounded_channel<T>() -> (CountedSender<T>, CountedReceiver<T>) {
    let (tx, rx) = unbounded_channel();
    let counter = Arc::new(AtomicUsize::new(0));

    let counted_sender = CountedSender {
        sender: tx,
        count: counter.clone(),
    };
    let counted_receiver = CountedReceiver {
        receiver: rx,
        count: counter,
    };

    (counted_sender, counted_receiver)
}

impl<T> CountedSender<T> {
    pub fn send(&self, item: T) -> Result<(), tokio::sync::mpsc::error::SendError<T>> {
        let result = self.sender.send(item);
        if result.is_ok() {
            self.count.fetch_add(1, Ordering::SeqCst);
        }
        result
    }

    pub fn len(&self) -> usize {
        self.count.load(Ordering::SeqCst)
    }

    pub fn is_empty(&self) -> bool {
        self.count.load(Ordering::SeqCst) == 0
    }
}

impl<T> CountedReceiver<T> {
    pub async fn recv(&mut self) -> Option<T> {
        match self.receiver.recv().await {
            Some(item) => {
                self.count.fetch_sub(1, Ordering::SeqCst);
                Some(item)
            }
            None => None,
        }
    }

    pub fn try_recv(&mut self) -> Result<T, tokio::sync::mpsc::error::TryRecvError> {
        match self.receiver.try_recv() {
            Ok(item) => {
                self.count.fetch_sub(1, Ordering::SeqCst);
                Ok(item)
            }
            Err(e) => Err(e),
        }
    }

    pub fn len(&self) -> usize {
        self.count.load(Ordering::SeqCst)
    }

    pub fn is_empty(&self) -> bool {
        self.count.load(Ordering::SeqCst) == 0
    }
}
