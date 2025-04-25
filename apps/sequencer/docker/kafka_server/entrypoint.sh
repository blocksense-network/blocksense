#!/bin/bash
# Generate a random Kafka Cluster ID
export KAFKA_CLUSTER_ID=$(/kafka_2.12-3.6.2/bin/kafka-storage.sh random-uuid)

# Format the Kafka storage with the generated Cluster ID
bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID -c config/kraft/server.properties --ignore-formatted

bin/kafka-server-start.sh config/kraft/server.properties

# Execute any additional commands passed to the container
exec "$@"
