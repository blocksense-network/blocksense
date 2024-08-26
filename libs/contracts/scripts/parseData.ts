import fs from 'fs/promises';

const chains = {
  'avalanche-fuji-testnet': 43113,
  'ethereum-testnet-sepolia-arbitrum-1': 421614,
  'ethereum-testnet-sepolia-optimism-1': 11155420,
  'ethereum-testnet-sepolia-scroll-1': 534351,
  'ethereum-testnet-sepolia-base-1': 84532,
  'ethereum-testnet-sepolia-zksync-1': 300,
  'ethereum-testnet-sepolia': 11155111,
  'polygon-testnet-amoy': 80002,
};

(async () => {
  const config = JSON.parse(
    await fs.readFile('./scripts/feeds_config.json', 'utf8'),
  );

  const pairs = config.feeds.map((d: any) => d.description);

  let files = await fs.readdir('./scripts/data');
  files = files.filter(f => Object.keys(chains).includes(f.split('.')[0]));

  const proxyData: {
    [key: string]: Array<{
      chainId: number;
      proxyAddress: string;
    }>;
  } = {};
  for (const file of files) {
    const data = await fs.readFile(`./scripts/data/${file}`, 'utf8');
    const json = JSON.parse(data);
    const chainId = chains[file.split('.')[0] as keyof typeof chains];
    for (const feed of json) {
      if (pairs.includes(feed.name) && feed.proxyAddress) {
        if (!proxyData[feed.name]) {
          proxyData[feed.name] = [];
        }
        proxyData[feed.name].push({
          chainId,
          proxyAddress: feed.proxyAddress,
        });
      }
    }
  }

  for (const feed of config.feeds) {
    const data = proxyData[feed.description];
    if (!data) {
      continue;
    }

    if (!feed['chainlink_compatibility']) {
      feed['chainlink_compatibility'] = {};
    }

    feed['chainlink_compatibility'].chainlink_proxy = data.reduce(
      (acc: any, curr: any) => ((acc[curr.chainId] = curr.proxyAddress), acc),
      {},
    );

    // {
    //   ...data.map(d => {
    //     return {
    //       [d.chainId]: d.proxyAddress,
    //     };
    //   }),
    // };
  }

  await fs.writeFile(
    './scripts/feeds_config2.json',
    JSON.stringify(config, null, 2),
  );
})();
