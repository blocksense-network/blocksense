use rand::distributions::Uniform;
use rand::Rng;
use extended_isolation_forest::{Forest, ForestOptions};

/*
"Extended Isolation Forest" paper - https://ieeexplore.ieee.org/document/8888179
Reference implementation - https://github.com/sahandha/eif
*/

fn make_f64_forest() -> Forest<f64, 3> {
    let rng = &mut rand::thread_rng();
    let distribution = Uniform::new(-4., 4.);
    let distribution2 = Uniform::new(10., 50.);
    let values: Vec<_> = (0..3000)
        .map(|_| [rng.sample(distribution), rng.sample(distribution), rng.sample(distribution2)])
        .collect();

    let options = ForestOptions {
        n_trees: 150,
        sample_size: 200,
        max_tree_depth: None,
        extension_level: 1,
    };
    Forest::from_slice(values.as_slice(), &options).unwrap()
}

fn main() {
    
}


#[cfg(test)]
mod extended_isolation_forest_tests {
    use crate::make_f64_forest;

    #[test]
    fn mock_test() {
        let forest = make_f64_forest();

        // no anomaly
        assert!(forest.score(&[1.0, 3.0, 25.0]) < 0.5);
        assert!(forest.score(&[-1.0, 3.0, 25.0]) < 0.5);

        // anomalies
        assert!(forest.score(&[-12.0, 6.0, 25.0]) > 0.5);
        assert!(forest.score(&[-1.0, 2.0, 60.0]) > 0.5);
        assert!(forest.score(&[-1.0, 2.0, 0.0]) > 0.5);
    }
}
