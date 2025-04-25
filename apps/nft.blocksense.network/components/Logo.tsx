const BLOCKSENSE_URL = 'https://blocksense.network/';

export const Logo = () => {
  return (
    <a
      href={BLOCKSENSE_URL}
      className="bs logo"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src="/images/logo.svg" alt="Blocksense logo" />
    </a>
  );
};
