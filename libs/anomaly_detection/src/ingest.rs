use std::{error::Error, fs::File, path::Path};

use csv::ReaderBuilder;

use crate::{extended_isolation_forest::make_f64_forest, hdbscan_detector::make_f64_hdbscan};

pub fn read_csv_to_vec(file_path: &str, column: &str) -> Result<Vec<f64>, Box<dyn Error>> {
    let file = File::open(Path::new(file_path))?;
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

/// Takes in Vec<f64> passes it through several Anomaly Detection algos and returns a score
///
/// The last value of `values` will be checked for anomalies
/// Sending an empty `values` vector will result in a panic!
pub fn anomaly_detector_aggregate(values: Vec<f64>) -> Result<f64, anyhow::Error> {
    const DIM: usize = 1; // Dimensionality of data

    let values_array: Vec<[f64; DIM]> = values.iter().map(|&x| [x]).collect();
    let last_value = *values_array.last().unwrap();

    let forest = make_f64_forest::<DIM>(values_array)?;

    let isolation_forest_result = forest.score(&last_value);

    let values_array = values.iter().map(|&x| vec![x]).collect();

    let detector_result = make_f64_hdbscan(values_array).unwrap();

    let hdbscan_result = f64::from(*detector_result.last().unwrap() == -1_i32);

    let aggregate_result = (isolation_forest_result + hdbscan_result) / 2.;

    Ok(aggregate_result)
}
