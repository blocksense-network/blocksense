import re
import shlex
import json
import time
from dataclasses import dataclass
from typing import List
from test_driver.errors import RequestedAssertionFailed

# --- Configuration ---
@dataclass
class TestConfig:
    """Centralized configuration for the integration test."""
    BASE_URL: str = "@BASE_URL@"
    INK_PORT: int = @INK_PORT@
    SEPOLIA_PORT: int = @SEPOLIA_PORT@
    SEQUENCER_ADMIN_PORT: int = @SEQUENCER_ADMIN_PORT@

    # Contract Addresses
    UPGRADEABLE_PROXY_CONTRACT: str = "@UPGRADEABLE_PROXY_CONTRACT@"
    CHAINLINK_PROXY_CONTRACT: str = "@CHAINLINK_PROXY_CONTRACT@"
    UPGRADEABLE_PROXY_ADFS_CONTRACT: str = "@UPGRADEABLE_PROXY_ADFS_CONTRACT@"
    CL_AGGREGATOR_ADAPTER_CONTRACT: str = "@CL_AGGREGATOR_ADAPTER_CONTRACT@"

    # Service Names
    REPORTER_SERVICE: str = "@REPORTER_SERVICE@"
    ANVIL_SEPOLIA_SERVICE: str = "@ANVIL_SEPOLIA_SERVICE@"
    ANVIL_INK_SERVICE: str = "@ANVIL_INK_SERVICE@"
    SEQUENCER_SERVICE: str = "@SEQUENCER_SERVICE@"

    # Timeouts
    ENDPOINT_EXISTENCE_TIMEOUT: int = @ENDPOINT_EXISTENCE_TIMEOUT@
    HISTORY_POPULATION_TIMEOUT: int = @HISTORY_POPULATION_TIMEOUT@
    NETWORK_UPDATE_TIMEOUT: int = @NETWORK_UPDATE_TIMEOUT@
    VALUE_CHANGE_TIMEOUT: int = @VALUE_CHANGE_TIMEOUT@
    VALUE_CHANGE_POLL_INTERVAL: int = @VALUE_CHANGE_POLL_INTERVAL@

    @property
    def INK_RPC_URL(self) -> str:
        return f"{self.BASE_URL}:{self.INK_PORT}"

    @property
    def SEPOLIA_RPC_URL(self) -> str:
        return f"{self.BASE_URL}:{self.SEPOLIA_PORT}"

    @property
    def SEQUENCER_ADMIN_URL(self) -> str:
        return f"{self.BASE_URL}:{self.SEQUENCER_ADMIN_PORT}"

    @property
    def SEQUENCER_METRICS_URL(self) -> str:
        return f"{self.BASE_URL}:{self.SEQUENCER_METRICS_PORT}"

    @property
    def services_to_wait_for(self) -> List[str]:
        return [
            self.ANVIL_SEPOLIA_SERVICE,
            self.ANVIL_INK_SERVICE,
            self.SEQUENCER_SERVICE,
            self.REPORTER_SERVICE,
        ]

    @property
    def ports_to_wait_for(self) -> List[int]:
        return [self.SEPOLIA_PORT, self.INK_PORT, self.SEQUENCER_ADMIN_PORT]

# Create a single instance of the config to be used throughout the script
test_config = TestConfig()


def wait_for_services(services):
    for service in services:
        machine.wait_for_unit(service)


def wait_for_ports(ports):
    for port in ports:
        machine.wait_for_open_port(port)


def check_log_for_pattern(service, pattern):
    """Asserts that a pattern is NOT found in a service's journald log."""
    log_output = machine.succeed(f"journalctl -u {service}")

    match = re.search(pattern, log_output, re.IGNORECASE | re.MULTILINE)

    if match:
        matched_text = match.group(0)
        line_number = log_output[:match.start()].count('\n') + 1

        raise RequestedAssertionFailed(
            f"Found unwanted pattern '{pattern}' in logs for {service}. "
            f"Matched text: '{matched_text}' at line {line_number}"
        )

    print(f"✓ No unwanted pattern '{pattern}' found in {service} logs")


def check_sequencer_admin_endpoint_exists(endpoint):
    """Checks that a sequencer endpoint returns a 2xx status code and returns the response."""
    return machine.wait_until_succeeds(f"curl -sf {test_config.SEQUENCER_ADMIN_URL}/{endpoint}", test_config.ENDPOINT_EXISTENCE_TIMEOUT)

def check_sequencer_metrics_endpoint_exists():
    """Checks that a sequencer metrics endpoint returns a 2xx status code and returns the response."""
    return machine.wait_until_succeeds(f"curl -sf {test_config.SEQUENCER_METRICS_URL}/metrics", test_config.ENDPOINT_EXISTENCE_TIMEOUT)

def check_sequencer_endpoint_json(endpoint):
    """Check that a sequencer endpoint returns valid JSON."""
    response = check_sequencer_admin_endpoint_exists(endpoint)

    try:
        json.loads(response)
        return response
    except json.JSONDecodeError as e:
        raise RequestedAssertionFailed(f"Endpoint '{endpoint}' returned invalid JSON: {e}")


def check_health_endpoint():
    """Checks the health endpoint for a 200 OK status and an empty body."""
    response = check_sequencer_admin_endpoint_exists("health")
    assert response == "", f"Health endpoint should return an empty body, but got: '{response}'"
    print("✓ health endpoint is responding correctly")


def check_metrics_endpoint():
    """Checks the metrics endpoint for a 200 OK status and valid Prometheus content."""
    response = check_sequencer_metrics_endpoint_exists()
    assert "sequencer_active_feeds" in response, "Metrics output is missing 'sequencer_active_feeds'"
    assert "updates_to_networks" in response, "Metrics output is missing 'updates_to_networks'"
    print("✓ metrics endpoint is responding with valid metrics")


def check_all_sequencer_endpoints():
    """Check all sequencer endpoints are responding correctly."""
    print("Checking all sequencer endpoints...")

    json_endpoints = [
        "get_feeds_config",
        "get_sequencer_config",
        "list_provider_status",
        "get_history",
        "get_oracle_scripts"
    ]

    for endpoint in json_endpoints:
        check_sequencer_endpoint_json(endpoint)
        print(f"✓ {endpoint} endpoint is responding with valid JSON")

    # Non-JSON endpoints
    check_metrics_endpoint()
    check_health_endpoint()

    print("✓ All sequencer endpoints are responding correctly")


def _get_network_name_from_rpc_url(rpc_url):
    """Derive network name from RPC URL."""
    url_map = {
        test_config.SEPOLIA_RPC_URL: "Sepolia",
        test_config.INK_RPC_URL: "Ink",
    }
    return url_map.get(rpc_url, "Unknown")


def _make_cast_call_base(
    contract_address, rpc_url, call_data="latestAnswer()", truncate_output=False
):
    """Base helper to execute 'cast call' commands."""
    safe_contract_address = shlex.quote(contract_address)
    safe_rpc_url = shlex.quote(rpc_url)
    network_name = _get_network_name_from_rpc_url(rpc_url)

    if re.match(r"^0x[0-9a-fA-F]+$", call_data):
        call_data_arg = f"--data {shlex.quote(call_data)}"
    else:
        call_data_arg = shlex.quote(call_data)

    # Execute just the cast call without post-processing pipeline
    command = f"@cast@ call {safe_contract_address} {call_data_arg} --rpc-url {safe_rpc_url}"

    try:
        raw_output = machine.succeed(command).strip()

        # Extract post-processing logic into Python
        processed_output = raw_output

        if truncate_output:
            # Replace "cut -c1-50" with Python string slicing
            processed_output = processed_output[:50]

        # Replace "cast to-dec" with Python conversion
        if processed_output.startswith('0x'):
            decimal_value = int(processed_output, 16)
            processed_output = str(decimal_value)

        # Log success with network name derived from RPC URL
        print(f"✓ {network_name} contract {contract_address} responded: {processed_output}")

        return processed_output

    except ValueError as e:
        raise RequestedAssertionFailed(f"Failed to convert hex output '{processed_output}' to decimal: {e}")
    except Exception as e:
        raise RequestedAssertionFailed(f"{network_name} contract {contract_address} failed to respond: {e}")


def make_cast_call_sepolia(
    contract_address, call_data="latestAnswer()", truncate_output=False
):
    """Make a cast call to Sepolia network and return the result."""
    return _make_cast_call_base(
        contract_address, test_config.SEPOLIA_RPC_URL, call_data, truncate_output
    )


def make_cast_call_ink(
    contract_address, call_data="latestAnswer()", truncate_output=False
):
    """Make a cast call to Ink network and return the result."""
    return _make_cast_call_base(
        contract_address, test_config.INK_RPC_URL, call_data, truncate_output
    )


def check_all_contracts():
    """Check all contracts respond successfully."""
    print("Checking all contracts...")

    make_cast_call_sepolia(
        test_config.UPGRADEABLE_PROXY_CONTRACT, "0x80000000", truncate_output=True
    )
    make_cast_call_sepolia(test_config.CHAINLINK_PROXY_CONTRACT)
    make_cast_call_ink(
        test_config.UPGRADEABLE_PROXY_ADFS_CONTRACT,
        "0x8200000000000000000000000000000000",
        truncate_output=True,
    )
    make_cast_call_ink(test_config.CL_AGGREGATOR_ADAPTER_CONTRACT)

    print("✓ All contracts responded successfully")


def wait_for_sequencer_history():
    """Waits until the sequencer history endpoint reports non-empty data."""
    machine.wait_until_succeeds(
        f"curl -s {test_config.SEQUENCER_ADMIN_URL}/get_history | @jq@ -e '.aggregate_history | all(. != [])'",
        test_config.HISTORY_POPULATION_TIMEOUT,
    )


def wait_for_ink_sepolia_updates(min_updates=2):
    """Waits for a minimum number of updates to the ink_sepolia network."""
    machine.wait_until_succeeds(
        f"curl -s {test_config.SEQUENCER_ADMIN_URL}/metrics | "
        + f"awk '/^updates_to_networks{{network=\"ink_sepolia\"}}/ {{ if ($2 <= {min_updates}) {{ exit 1 }} }} END {{ exit 0 }}'",
        test_config.NETWORK_UPDATE_TIMEOUT,
    )


def run_initial_health_checks():
    """Checks that services are up and endpoints are available."""
    wait_for_services(test_config.services_to_wait_for)
    wait_for_ports(test_config.ports_to_wait_for)
    check_all_sequencer_endpoints()


def run_core_logic_checks():
    """Verifies the main data pipeline and on-chain updates."""
    initial_value = make_cast_call_sepolia(test_config.CHAINLINK_PROXY_CONTRACT)

    wait_for_sequencer_history()
    wait_for_ink_sepolia_updates()

    check_log_for_pattern(test_config.REPORTER_SERVICE, "panic")
    check_log_for_pattern(
        test_config.REPORTER_SERVICE, "Sequencer responded with status=(?!200)\\d+"
    )

    final_value = initial_value
    for _ in range(test_config.VALUE_CHANGE_TIMEOUT // test_config.VALUE_CHANGE_POLL_INTERVAL):
        final_value = make_cast_call_sepolia(test_config.CHAINLINK_PROXY_CONTRACT)
        if final_value != initial_value:
            break
        time.sleep(test_config.VALUE_CHANGE_POLL_INTERVAL)

    assert initial_value != final_value, (
        f"Value did not change from {initial_value} within "
        f"{test_config.VALUE_CHANGE_TIMEOUT}s timeout."
    )
    print(f"✓ Chainlink proxy value changed: {initial_value} -> {final_value}")


"""Main test execution function."""
machine.start()
machine.wait_for_unit("multi-user.target")

run_initial_health_checks()
run_core_logic_checks()
check_all_contracts()

print("\n🎉 All integration tests passed successfully!")
