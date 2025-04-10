use blocksense_anomaly_detection::{
    extended_isolation_forest::make_f64_forest, ingest::read_csv_to_vec,
};

fn main() {
    let values = read_csv_to_vec("../../python_scripts/yfinance_nvda.csv", "Close").unwrap();

    const DIM: usize = 1; // Dimensionality of data

    let values_array = values.iter().map(|&x| [x]).collect();

    let forest = make_f64_forest::<DIM>(values_array).expect("Error building forest");

    let result = forest.score(&[0.]);

    println!("{}", result);
}
