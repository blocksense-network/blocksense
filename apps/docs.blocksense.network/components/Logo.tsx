import React from 'react';

export const Logo = () => {
  return (
    <aside className="blocksense-header" style={styles.container}>
      <img
        className="blocksense-header__graphic"
        src="/images/blocksense-header__graphic.jpg"
        style={styles.header__graphic}
        alt="Blocksense Logo"
      />
      <p className="blocksense-header__text" style={styles.text}>
        Blocksense
      </p>
    </aside>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
  },
  header__graphic: {
    height: '70px',
    marginRight: '5px',
  },
  text: {
    fontSize: '22px',
    fontWeight: 700,
    fontFamily: '"Space Mono", monospace',
    color: 'rgb(30, 30, 30)',
  },
};
