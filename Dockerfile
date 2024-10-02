#FROM alpine:3.18 AS build-environment
FROM ubuntu:24.04 AS build-environment
# ARG TARGETARCH
WORKDIR /opt

RUN apt-get update
#RUN apk add clang lld curl build-base linux-headers git \
#    openssl-dev libusb-dev \
RUN apt-get install -y build-essential git clang curl \
    librust-openssl-dev libusb-dev \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs > rustup.sh \
    && chmod +x ./rustup.sh \
    && ./rustup.sh --default-toolchain 1.80.0 -y

# Add .cargo/bin to PATH
ENV PATH="/root/.cargo/bin:${PATH}"


WORKDIR /opt/blocksense
COPY . .


RUN --mount=type=cache,target=/root/.cargo/registry --mount=type=cache,target=/root/.cargo/git --mount=type=cache,target=/opt/blocksense/target \
    RUST_BACKTRACE=1 cargo build --release \
    && mkdir out \
    && mv target/release/sequencer out/sequencer \
    && mv target/release/launch_reporter out/launch_reporter \
    && strip out/sequencer \
    && strip out/launch_reporter;

FROM ubuntu:24.04 AS blocksense
RUN apt-get update
RUN apt-get install -y wget curl

COPY --from=build-environment /opt/blocksense/out/sequencer       /usr/local/bin/sequencer
COPY --from=build-environment /opt/blocksense/out/launch_reporter /usr/local/bin/launch_reporter
WORKDIR /usr/local/blocksense

ENV SEQUENCER_CONFIG_DIR=/usr/local/blocksense/apps/sequencer
ENV REPORTER_CONFIG_DIR=/usr/local/blocksense/apps/reporter
ENV FEEDS_CONFIG_DIR=/usr/local/blocksense

COPY config/docker/sequencer_config.json /usr/local/blocksense/apps/sequencer/sequencer_config.json
COPY config/docker/feeds_config.json     /usr/local/blocksense/feeds_config.json
COPY config/docker/sequencer_priv_key_test /tmp/priv_key_test
COPY config/docker/reporter_config.json  /usr/local/blocksense/apps/reporter/reporter_config.json
COPY config/docker/reporter_secret_key   /usr/local/blocksense/apps/reporter/reporter_secret_key

ENTRYPOINT ["/bin/sh", "-c", "sequencer"]
