CREATE TABLE
  participants_unique (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    x_handle TEXT NOT NULL UNIQUE,
    x_id TEXT UNIQUE,
    discord_username TEXT NOT NULL UNIQUE,
    discord_id TEXT UNIQUE,
    user_address TEXT NOT NULL UNIQUE,
    user_signature TEXT UNIQUE,
    server_signature TEXT UNIQUE,
    minting_tx TEXT UNIQUE
  );
