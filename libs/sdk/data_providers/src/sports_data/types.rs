use std::collections::HashMap;

pub type SportType = String;

#[derive(Clone, Debug)]
pub struct SportsResultData {
    pub sport_type: SportType,
    pub data: Vec<u8>,
}

pub type SportsResults = HashMap<u128, Vec<u8>>;
