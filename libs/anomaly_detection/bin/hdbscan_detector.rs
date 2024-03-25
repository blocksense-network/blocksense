use hdbscan::{DistanceMetric, Hdbscan, HdbscanHyperParams};

fn main() {

    let data: Vec<Vec<f32>> = vec![
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

    let clusterer = Hdbscan::default(&data);
    let result = clusterer.cluster().unwrap();

    println!("First: {:?}", result);

    let config = HdbscanHyperParams::builder()
        .min_cluster_size(3)
        .min_samples(2)
        .dist_metric(DistanceMetric::Manhattan)
        .build();

    let clusterer = Hdbscan::new(&data, config);
    let result = clusterer.cluster().unwrap();
    println!("Second: {:?}", result);
}

