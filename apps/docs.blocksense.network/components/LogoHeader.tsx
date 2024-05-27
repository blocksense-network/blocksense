import React from 'react';

export const LogoHeader = () => {
  return (
    <div style={styles.container}>
      <img
        src="/images/blocksense-logo.jpg"
        alt="Blocksense Logo"
        style={styles.logo}
      />
      <h1 style={styles.text}>Blocksense Network Documentation</h1>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    height: '50px',
    marginRight: '15px',
  },
  text: {
    fontSize: '24px',
  },
};
