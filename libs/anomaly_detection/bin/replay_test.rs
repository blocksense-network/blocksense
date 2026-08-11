use anomaly_detection::ingest::anomaly_detector_aggregate;
use std::time::{Duration, Instant};

fn main() {
    let input_file = "replay_test_sample_input";
    let input_text = std::fs::read_to_string(input_file).unwrap();
    let mut i = 1;
    for line in input_text.lines() {
        let input_vec = line
            .split(" ")
            .map(|x| x.parse::<f64>().unwrap())
            .collect::<Vec<f64>>();

        print!("replay #{i}; input_vec.len()={}; ", input_vec.len());
        i += 1;

        let now = Instant::now();
        if let Ok(anomaly_score) = anomaly_detector_aggregate(input_vec) {
            let elapsed = now.elapsed().as_millis();

            println!("anomaly_score={anomaly_score}; time={elapsed}ms");
        } else {
            println!("skip");
        }
    }
}
