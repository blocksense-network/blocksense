use std::{error::Error, fs::File};

use csv::ReaderBuilder;

pub fn read_csv_to_vec(file_path: &str, column: &str) -> Result<Vec<f64>, Box<dyn Error>> {
    let file = File::open(file_path)?;
    let mut rdr = ReaderBuilder::new().has_headers(true).from_reader(file);

    let headers = rdr.headers()?.clone();
    let close_index = headers
        .iter()
        .position(|h| h == column)
        .ok_or("Column not found")?;

    let mut vec = Vec::new();
    for result in rdr.records() {
        let record = result?;
        let value = record[close_index].parse()?;
        vec.push(value);
    }

    Ok(vec)
}
