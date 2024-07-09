use hdbscan::{DistanceMetric, Hdbscan, HdbscanError, HdbscanHyperParams};

pub fn make_f64_hdbscan(data: Vec<Vec<f64>>) -> Result<Vec<i32>, HdbscanError> {
    let config = HdbscanHyperParams::builder()
        .min_cluster_size(3)
        .min_samples(2)
        .dist_metric(DistanceMetric::Manhattan)
        .build();

    let clusterer = Hdbscan::new(&data, config);
    clusterer.cluster()
}

#[cfg(test)]
mod hdbscan_tests {
    use crate::hdbscan_detector::make_f64_hdbscan;

    #[test]
    fn test1() {
        let data: Vec<Vec<f64>> = vec![
            vec![1.5, 2.2],
            vec![1.0, 1.1],
            vec![1.2, 1.4],
            vec![0.8, 1.0],
            vec![10.0, 10.0],
            vec![1.1, 1.0],
            vec![3.9, 3.9],
            vec![3.6, 4.1],
            vec![3.8, 3.9],
            vec![4.0, 4.1],
            vec![3.7, 4.0],
        ];

        let result = make_f64_hdbscan(data).unwrap();

        println!("{:?}", result);

        let anomaly_count = result.iter().filter(|&&x| x == -1).count();

        assert_eq!(anomaly_count, 1);
    }
}
