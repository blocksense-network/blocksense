use std::{error::Error, fs::File, path::Path};

use anyhow::Context;
use csv::ReaderBuilder;
use tracing::debug;

// use crate::{extended_isolation_forest::make_f64_forest, hdbscan_detector::make_f64_hdbscan};

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
    debug!("[AD] input: values={values:?}");

    const DIM: usize = 1; // Dimensionality of data

    debug!(
        "[AD] packing values into single-element arrays; values.len()={}",
        values.len()
    );
    let values_array: Vec<[f64; DIM]> = values.iter().map(|&x| [x]).collect();

    debug!("[AD] getting last value");
    let last_value = *values_array
        .last()
        .context("Not enough values for anomaly detection")?;

    debug!("[AD] bypassing and returning last_value={last_value:?}");
    Ok(last_value[0])
    /*
    debug!("[AD] about to make forest...; last_value={last_value:?}");
    let forest = make_f64_forest::<DIM>(values_array)?;
    debug!("[AD] done making forest");

    debug!("[AD] computing score...");
    let isolation_forest_result = forest.score(&last_value);
    debug!("[AD] done computing score; isolation_forest_result={isolation_forest_result}");

    debug!("[AD] again packing values into single-element arrays");
    let values_array = values.iter().map(|&x| vec![x]).collect();

    debug!("[AD] before make_f64_hdbscan");
    let detector_result =
        make_f64_hdbscan(values_array).context("hdbscan error during anomaly detection")?;
    debug!("[AD] after make_f64_hdbscan");

    debug!("[AD] converting result");
    let hdbscan_result = f64::from(*detector_result.last().unwrap() == -1_i32);

    let aggregate_result = (isolation_forest_result + hdbscan_result) / 2.;

    debug!("[AD] aggregate_result = {aggregate_result}");

    Ok(aggregate_result)
    */
}
