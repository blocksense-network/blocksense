import re

def wait_for_services(services):
    for service in services:
        machine.wait_for_unit(service)

def wait_for_ports(ports):
    for port in ports:
        machine.wait_for_open_port(port)

def check_log_for_pattern(service, pattern):
    """Asserts that a pattern is NOT found in a service's journald log."""
    machine.fail(f"journalctl -u {service} | grep -iP '{pattern}'")

def check_sequencer_endpoint_exists(endpoint):
    """Checks that a sequencer endpoint returns exists."""
    machine.succeed(f"curl -s http://127.0.0.1:5553/{endpoint}")

def _make_cast_call_base(contract_address, rpc_url, call_data="latestAnswer()", truncate_output=False):
    """Base helper to execute 'cast call' commands."""
    if re.match(r"^0x[0-9a-fA-F]+$", call_data):
        call_data_arg = f"--data {call_data}"
    else:
        call_data_arg = f'"{call_data}"'

    command = f"cast call {contract_address} {call_data_arg} --rpc-url {rpc_url}"

    post_process = []
    if truncate_output:
        post_process.append("cut -c1-50")
    post_process.append("cast to-dec")

    command += f" | {' | '.join(post_process)}"

    return machine.succeed(command).strip()

def make_cast_call_sepolia(contract_address, call_data="latestAnswer()", truncate_output=False):
    return _make_cast_call_base(contract_address, "http://127.0.0.1:8546", call_data, truncate_output)

def make_cast_call_ink(contract_address, call_data="latestAnswer()", truncate_output=False):
    return _make_cast_call_base(contract_address, "http://127.0.0.1:8547", call_data, truncate_output)

def check_all_contracts():
    # Using UpgradeableProxy contract
    make_cast_call_sepolia("0xee5a4826068c5326a7f06fd6c7cbf816f096846c", "0x80000000", truncate_output=True)
    # Using ChainlinkProxy contract
    make_cast_call_sepolia("0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17")
    # Using UpgradeableProxyADFS contract
    make_cast_call_ink("0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b", "0x8200000000000000000000000000000000", truncate_output=True)
    # Using CLAggregatorAdapter contract
    make_cast_call_ink("0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f")

machine.start()
machine.wait_for_unit("multi-user.target")

wait_for_services([
    "blocksense-anvil-ethereum-sepolia.service",
    "blocksense-anvil-ink-sepolia.service",
    "blocksense-sequencer.service",
    "blocksense-reporter-a.service",
])
wait_for_ports([8546, 8547, 5553])

# Capture initial on-chain value for a feed
initial_value = make_cast_call_sepolia("0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17")

# Wait until the aggregate_history is populated
machine.wait_until_succeeds(
    "curl -s http://127.0.0.1:5553/get_history | jq -e '.aggregate_history | all(. != [])'", 360
)

# Test that sequencer config endpoints are available
check_sequencer_endpoint_exists("get_config")
check_sequencer_endpoint_exists("get_feeds_config")

# Wait until each feed has been updated at least twice
machine.wait_until_succeeds(
    "curl -s http://127.0.0.1:5553/metrics | "
    + "awk '/^updates_to_networks{network=\"ink_sepolia\"/ { if ($2 <= 2) exit 1 } END { exit 0 }'"
)

# Check reporter logs for panics or non-200 responses from the sequencer
check_log_for_pattern("blocksense-reporter-a.service", "panic")
check_log_for_pattern("blocksense-reporter-a.service", "Sequencer responded with status=(?!200)\\d+")

check_all_contracts()

machine.sleep(10)
# Check that the on-chain value has changed
final_value = make_cast_call_sepolia("0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17")
assert initial_value != final_value, f"Value did not change from {initial_value}"
