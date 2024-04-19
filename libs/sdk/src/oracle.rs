pub struct Settings {
    pub id: String,
}

impl Settings {
    pub fn new(id: impl Into<String>) -> Self {
        Self { id: id.into() }
    }
}

pub struct Payload {
    pub body: Option<u64>,
}

impl Payload {
    pub fn new(_body: u64) -> Self {
        Self { body: None }
    }
}
