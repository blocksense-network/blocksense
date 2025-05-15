# Oracle trigger for Spin runtime

This is the node operator runtime that executes the oracle scripts and sends the results
for the registered data feeds. On most linux distributions this appoach should work

1. Build blocksense project
   `blocksense$ cargo build --release`
2. go to build directory
   `cd blocksense/target/release`
3. Create archive containing the binary:
   `tar czf trigger-oracle-spin-plugin-archive.tar.gz trigger-oracle`

4. Compute the sha256sum of the archive:
   `sha256sum trigger-oracle_v0.1.1.tar.gz`

5. Create the json file named `./trigger-oracle.json` with following contents replacing the values accordingly

```json
{
  "name": "trigger-oracle",
  "description": "Run Blocksense oracle components at timed intervals",
  "homepage": "https://github.com/blocksense-network/blocksense/tree/main/apps/trigger-oracle",
  "version": "0.1.1",
  "spinCompatibility": ">=2.2",
  "license": "Apache-2.0",
  "packages": [
    {
      "os": "linux",
      "arch": "amd64",
      "url": "file:///...../blocksense/apps/trigger-oracle/trigger-oracle_v0.1.1.tar.gz",
      "sha256": "b3aafb3bc12bba1c5dfa2c9d31cbeb0b17189c92fc9581ef0a21a561197162cd"
    }
  ]
}
```

6. Install plugin in spin:
   `spin plugin install --yes --file ./trigger-oracle.json`
