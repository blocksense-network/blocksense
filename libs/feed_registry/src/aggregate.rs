use std::{
    collections::HashMap,
    fmt::{Debug, Display},
};

use num::Integer;
use tracing::{error, info_span};

use super::types::FeedType;

pub enum ConsensusMetric {
    Median,
    Mean(AverageAggregator),
}

#[allow(unreachable_patterns)]
impl Display for ConsensusMetric {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            ConsensusMetric::Median => write!(f, "TODO(snikolov): Median"),
            ConsensusMetric::Mean(x) => write!(f, "{}", x),
            _ => write!(f, "Display not implemented for ConsensusMetric!"),
        }
    }
}

pub trait FeedAggregate: Send + Sync {
    fn aggregate(&self, values: &[FeedType]) -> FeedType;
}

pub struct AverageAggregator {}

impl Display for AverageAggregator {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "AverageAggregator")
    }
}

impl FeedAggregate for AverageAggregator {
    fn aggregate(&self, values: &[FeedType]) -> FeedType {
        let span = info_span!("AverageAggregator");
        let _guard = span.enter();
        assert!(!values.is_empty());
        let num_elements = values.len() as f64;
        let mut filtered = Vec::new();

        for value in values {
            match value {
                FeedType::Numerical(x) => filtered.push(x),
                _ => error!("Attempting to perform arithmetic on non-numerical type!"), //TODO(snikolov): What level of error?
            };
        }

        let sum: f64 = filtered.into_iter().sum();
        FeedType::Numerical(sum / num_elements)
    }
}

pub struct MedianAggregator {}

impl FeedAggregate for MedianAggregator {
    fn aggregate(&self, values: &[FeedType]) -> FeedType {
        let span = info_span!("MedianAggregator");
        let _guard = span.enter();
        let mut filtered = Vec::new();

        for value in values {
            match value {
                FeedType::Numerical(x) => filtered.push(x),
                _ => error!("Attempting to perform arithmetic on non-numerical type!"), //TODO(snikolov): What level of error?
            };
        }
        let size = filtered.len();
        assert!(size > 0);
        filtered.sort_by(|a, b| {
            a.partial_cmp(b)
                .expect("Ordering between elements does not exists.")
        });

        let middle = size / 2;
        if size.is_odd() {
            FeedType::Numerical(*filtered[middle])
        } else {
            FeedType::Numerical((filtered[middle] + filtered[middle - 1]) / 2.0)
        }
    }
}

pub fn get_aggregator(aggredate_type: &str) -> Box<dyn FeedAggregate> {
    match aggredate_type {
        "Median" => Box::new(MedianAggregator {}),
        "Majority" => Box::new(MajorityVoteAggregator {}),
        "Average" => Box::new(AverageAggregator {}),

        _ => panic!("Unknown aggregate type: {}", aggredate_type),
    }
}

pub struct MajorityVoteAggregator {}

impl FeedAggregate for MajorityVoteAggregator {
    fn aggregate(&self, values: &[FeedType]) -> FeedType {
        let span = info_span!("MajorityVoteAggregator");
        let _guard = span.enter();

        let mut frequency_map = HashMap::new();

        // Count the occurrences of each string
        for v in values {
            match v {
                FeedType::Text(t) => *frequency_map.entry(t).or_insert(0) += 1,
                _ => {
                    error!("Attempting to perform frequency_map on f64!");
                }
            }
        }

        // Find the string with the maximum occurrences
        let result = frequency_map
            .into_iter()
            .max_by_key(|&(_, count)| count)
            .map(|(s, _)| s)
            .expect("Aggregating empty set of values!")
            .clone();
        FeedType::Text(result)
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

        let result = aggregator.aggregate(&values[..]);
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

        let result = aggregator.aggregate(&values[..]);

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

        let result = aggregator.aggregate(&values[..]);

        assert_eq!(
            result,
            FeedType::Numerical(99999999999999999999999999999999999.5)
        );
    }

    #[test]
    fn test_average_aggregator_wrong_value() {
        let aggregator = AverageAggregator {};

        let values: Vec<FeedType> = vec![0., 0.].into_iter().map(FeedType::Numerical).collect();

        let result = aggregator.aggregate(&values[..]);

        assert_ne!(result, FeedType::Numerical(0.00000000001));
    }
}
