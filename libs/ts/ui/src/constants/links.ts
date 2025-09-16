export type Links = {
  website: {
    home: string;
    letsTalk: string;
    litepaper: string;
  };
  docs: {
    home: string;
  };
  repos: {
    blocksenseOS: string;
  };
  social: {
    x: string;
    discord: string;
  };
};

export const links: Links = {
  website: {
    home: 'https://blocksense.network',
    letsTalk: 'https://blocksense.network/lets-talk',
    litepaper: 'https://blocksense.network/resources/litepaper',
  },
  docs: {
    home: 'https://docs.blocksense.network',
  },
  repos: {
    blocksenseOS: 'https://github.com/blocksense-network/BlocksenseOS',
  },
  social: {
    x: 'https://x.com/blocksense_',
    discord: 'https://discord.com/invite/blocksense',
  },
};
