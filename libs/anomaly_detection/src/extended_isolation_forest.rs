use anyhow::Result;
use extended_isolation_forest::{Forest, ForestOptions};

/*
"Extended Isolation Forest" paper - https://ieeexplore.ieee.org/document/8888179
Reference implementation - https://github.com/sahandha/eif
*/
pub fn make_f64_forest<const N: usize>(values: Vec<[f64; N]>) -> Result<Forest<f64, N>> {
    let options = ForestOptions {
        n_trees: 150,
        sample_size: 200,
        max_tree_depth: None,
        extension_level: 0, //TODO(snikolov): Figure out why it's required `extension_level` < `Dimensions`
    };

    match Forest::from_slice(values.as_slice(), &options) {
        Ok(res) => Ok(res),
        Err(e) => anyhow::bail!("Error building forest from trainig data: {}", e.to_string()),
    }
}

pub fn is_anomaly<const N: usize>(forest: &Forest<f64, N>, data_point: &[f64; N]) -> f64 {
    forest.score(data_point)
}

#[cfg(test)]
mod tests {
    use rand::Rng;
    use rand_distr::Uniform;

    use crate::extended_isolation_forest::{is_anomaly, make_f64_forest};

    #[test]
    fn eif_scores_3d_uniform_dist_correctly() {
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

        let forest = make_f64_forest::<3>(values.to_vec()).expect("Error building forest");

        // no anomaly
        assert!(is_anomaly::<3>(&forest, &[0.0, 0.0, 35.0]) < 0.5);

        // anomalies
        assert!(is_anomaly::<3>(&forest, &[-120.0, 6.0, 25.0]) > 0.5);
        assert!(is_anomaly::<3>(&forest, &[-1.0, 2.0, 600.0]) > 0.5);
        assert!(is_anomaly::<3>(&forest, &[-1.0, 2.0, -50.0]) > 0.5);
    }
}
