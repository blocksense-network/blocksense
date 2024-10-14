use std::collections::HashMap;
use std::fmt::{Debug, Display};

use super::types::FeedType;

pub enum ConsensusMetric {
    Median,
    Mean(AverageAggregator),
    Majority(MajorityAggregator),
}

#[allow(unreachable_patterns)]
impl Display for ConsensusMetric {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            ConsensusMetric::Median => write!(f, "TODO: Median"),
            ConsensusMetric::Mean(x) => write!(f, "{}", x),
            ConsensusMetric::Majority(x) => write!(f, "{}", x),
            _ => write!(f, "Display not implemented for ConsensusMetric!"),
        }
    }
}

pub trait FeedAggregate: Send + Sync {
    fn aggregate(&self, values: Vec<&FeedType>) -> FeedType;
}

pub struct AverageAggregator {}

impl Display for AverageAggregator {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "AverageAggregator")
    }
}

impl FeedAggregate for AverageAggregator {
    fn aggregate(&self, values: Vec<&FeedType>) -> FeedType {
        let num_elements = values.len() as f64;

        let values: Vec<&f64> = values
            .into_iter()
            .map(|value| match value {
                FeedType::Numerical(x) => x,
                _ => panic!("Attempting to perform arithmetic on non-numerical type!"), //TODO(snikolov): What level of error?
            })
            .collect();

        let sum: f64 = values.into_iter().sum();
        FeedType::Numerical(sum / num_elements)
    }
}

pub struct MajorityAggregator {}

impl Display for MajorityAggregator {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "MajorityAggregator")
    }
}

impl FeedAggregate for MajorityAggregator {
    /// Aggregates a list of feed values, returning the most frequently occurring value.
    ///
    /// # Notes
    ///
    /// In the case where there is no clear majority (a tie), the function does not guarantee which
    /// of the most frequent values will be returned.
    fn aggregate(&self, values: Vec<&FeedType>) -> FeedType {
        let mut counts = HashMap::new();

        for value in values {
            let count = counts.entry(value.clone()).or_insert(0);
            *count += 1;
        }

        let (majority_value, _) = counts
            .into_iter()
            .max_by_key(|&(_, count)| count)
            .expect("No values provided");

        majority_value
    }
}

impl Debug for dyn FeedAggregate {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "FeedAggregate")
    }
}

impl Display for dyn FeedAggregate {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "FeedAggregate")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn average_aggregator_1() {
        let aggregator = AverageAggregator {};

        let values: Vec<FeedType> = vec![2., 2., 3.]
            .into_iter()
            .map(FeedType::Numerical)
            .collect();

        let result = aggregator.aggregate(values.iter().collect());
        let expected_result = (2. + 2. + 3.) / 3.;
        assert_eq!(FeedType::Numerical(expected_result), result);
    }

    #[test]
    fn test_average_aggregator_2() {
        let aggregator = AverageAggregator {};

        let values: Vec<FeedType> = vec![0., 0., 0.]
            .into_iter()
            .map(FeedType::Numerical)
            .collect();

        let result = aggregator.aggregate(values.iter().collect());

        assert_eq!(result, FeedType::Numerical(0.));
    }

    #[test]
    fn test_average_aggregator_3() {
        let aggregator = AverageAggregator {};

        let values: Vec<FeedType> = vec![
            99999999999999999999999999999999999.,
            99999999999999999999999999999999998.,
        ]
        .into_iter()
        .map(FeedType::Numerical)
        .collect();

        let result = aggregator.aggregate(values.iter().collect());

        assert_eq!(
            result,
            FeedType::Numerical(99999999999999999999999999999999999.5)
        );
    }

    #[test]
    fn test_average_aggregator_wrong_value() {
        let aggregator = AverageAggregator {};

        let values: Vec<FeedType> = vec![0., 0.].into_iter().map(FeedType::Numerical).collect();

        let result = aggregator.aggregate(values.iter().collect());

        assert_ne!(result, FeedType::Numerical(0.00000000001));
    }

    #[test]
    fn majority_aggregator_basic() {
        let aggregator = MajorityAggregator {};

        let values: Vec<FeedType> = vec![
            FeedType::Text("apple".to_string()),
            FeedType::Text("apple".to_string()),
            FeedType::Text("banana".to_string()),
        ];

        let result = aggregator.aggregate(values.iter().collect());
        assert_eq!(FeedType::Text("apple".to_string()), result);
    }

    #[test]
    fn majority_aggregator_all_same() {
        let aggregator = MajorityAggregator {};

        let values: Vec<FeedType> = vec![
            FeedType::Text("apple".to_string()),
            FeedType::Text("apple".to_string()),
            FeedType::Text("apple".to_string()),
        ];

        let result = aggregator.aggregate(values.iter().collect());

        assert_eq!(result, FeedType::Text("apple".to_string()));
    }

    #[test]
    fn majority_aggregator_mixed() {
        let aggregator = MajorityAggregator {};

        let values: Vec<FeedType> = vec![
            FeedType::Text("apple".to_string()),
            FeedType::Numerical(42.0),
            FeedType::Text("apple".to_string()),
            FeedType::Numerical(42.0),
            FeedType::Numerical(42.0),
        ];

        let result = aggregator.aggregate(values.iter().collect());

        assert_eq!(result, FeedType::Numerical(42.0));
    }

    #[test]
    fn majority_aggregator_no_majority() {
        // This test demonstrates there is no ordering guarantee in case of no majority
        let aggregator = MajorityAggregator {};

        let values: Vec<FeedType> = vec![
            FeedType::Text("apple".to_string()),
            FeedType::Text("banana".to_string()),
            FeedType::Text("cherry".to_string()),
        ];

        let result = aggregator.aggregate(values.iter().collect());

        assert!(matches!(result,
            FeedType::Text(ref text) if text == "apple" || text == "banana" || text == "cherry"));
    }
}
