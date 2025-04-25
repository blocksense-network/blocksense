use blocksense_anomaly_detection::{hdbscan_detector::make_f64_hdbscan, ingest::read_csv_to_vec};

fn main() {
    let values = read_csv_to_vec("../../python_scripts/yfinance_nvda.csv", "Close").unwrap();

    let values_array = values.iter().map(|&x| vec![x]).collect();

    let detector_result = make_f64_hdbscan(values_array).unwrap();

    println!("{:?}", detector_result);
}
