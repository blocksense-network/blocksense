# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Set the environment variable for non-interactive installation
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary packages, including curl, default JRE, and bash
RUN apt-get update && apt-get install -y \
    default-jre \
    curl \
    bash \
    && apt-get clean

# Download Kafka 3.6.2 from the official Apache mirror
RUN curl -O https://archive.apache.org/dist/kafka/3.6.2/kafka_2.12-3.6.2.tgz

# Extract the downloaded Kafka tarball
RUN tar xvfz kafka_2.12-3.6.2.tgz

# Set the working directory to the extracted Kafka directory
WORKDIR kafka_2.12-3.6.2

# Copy the entrypoint script into the container
COPY entrypoint.sh /entrypoint.sh

# Make the entrypoint script executable
RUN chmod +x /entrypoint.sh

# Use bash as the default shell
SHELL ["/bin/bash", "-c"]

# Set the entrypoint to run the entrypoint.sh script
ENTRYPOINT ["/entrypoint.sh"]
