use extended_isolation_forest::{Forest, ForestOptions};

/*
"Extended Isolation Forest" paper - https://ieeexplore.ieee.org/document/8888179
Reference implementation - https://github.com/sahandha/eif
*/

#[allow(dead_code)]
pub fn make_f64_forest<const N: usize>(values: Vec<[f64; N]>) -> Forest<f64, N> {
    let values_array: Vec<[f64; N]> = values.iter().map(|&x| x.try_into().unwrap()).collect();

    let options = ForestOptions {
        n_trees: 150,
        sample_size: 200,
        max_tree_depth: None,
        extension_level: 0, //TODO(snikolov): Figure out why it's required x < Dimensions
    };

    Forest::from_slice(values_array.as_slice(), &options).unwrap()
}

#[cfg(test)]
mod extended_isolation_forest_tests {
    use rand::Rng;
    use rand_distr::Uniform;

    use crate::extended_isolation_forest::make_f64_forest;

    #[test]
    fn mock_test() {
        let rng = &mut rand::thread_rng();
        let distribution = Uniform::new(-4., 4.);
        let distribution2 = Uniform::new(10., 50.);
        let values: Vec<_> = (0..3000)
            .map(|_| {
                [
                    rng.sample(distribution),
                    rng.sample(distribution),
                    rng.sample(distribution2),
                ]
            })
            .collect();

        let forest = make_f64_forest::<3>(values.to_vec());

        // no anomaly
        assert!(forest.score(&[0.0, 0.0, 35.0]) < 0.5);

        // anomalies
        assert!(forest.score(&[-120.0, 6.0, 25.0]) > 0.5);
        assert!(forest.score(&[-1.0, 2.0, 600.0]) > 0.5);
        assert!(forest.score(&[-1.0, 2.0, -50.0]) > 0.5);
    }
}
