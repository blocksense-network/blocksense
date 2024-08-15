use std::fmt::{Debug, Display};

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
}
