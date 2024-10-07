CREATE TABLE feed_schemas (
    id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    schema_format TEXT(1000),
    PRIMARY KEY (id)
);

CREATE TABLE ontology (
    id INT AUTO_INCREMENT,
    markt_id INT NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT(1000) NULL,
    PRIMARY KEY (id)
);

CREATE TABLE football_events (
    id INT AUTO_INCREMENT,
    markt_id INT NOT NULL UNIQUE,
    status ENUM('draft', 'published'),
    event_datetime DATETIME,
    description TEXT(1000) NULL,
    schema_id INT,
    team_a_markt_id INT NOT NULL,
    team_b_markt_id INT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_schema_id FOREIGN KEY (schema_id) REFERENCES feed_schemas(id),
    CONSTRAINT fk_team_a_markt_id FOREIGN KEY (team_a_markt_id) REFERENCES ontology(markt_id),
    CONSTRAINT fk_team_b_markt_id FOREIGN KEY (team_b_markt_id) REFERENCES ontology(markt_id)
);

ALTER TABLE football_events ADD COLUMN feed_id VARCHAR(100) NULL;
ALTER TABLE football_events ADD COLUMN voting_start_time BIGINT NULL;
ALTER TABLE football_events ADD COLUMN voting_end_time BIGINT NULL;



INSERT INTO feed_schemas (id, name, schema_format) VALUES
    (1, 'football_events', 'todo: schema here')
;

INSERT INTO ontology (markt_id, name, description) VALUES
    (281, 'Manchester City', NULL),
    (11, 'Arsenal FC', NULL),
    (631, 'Chelsea FC', NULL),
    (31, 'Liverpool FC', NULL),
    (985, 'Manchester United', NULL),
    (148, 'Tottenham Hotspur', NULL),
    (762, 'Newcastle United', NULL),
    (405, 'Aston Villa', NULL),
    (1237, 'Brighton & Hove Albion', NULL),
    (379, 'West Ham United', NULL),
    (873, 'Crystal Palace', NULL),
    (703, 'Nottingham Forest', NULL),
    (1148, 'Brentford FC', NULL),
    (543, 'Wolverhampton Wanderers', NULL),
    (989, 'AFC Bournemouth', NULL),
    (29, 'Everton FC', NULL),
    (931, 'Fulham FC', NULL),
    (180, 'Southampton FC', NULL),
    (1003, 'Leicester City', NULL),
    (677, 'Ipswich Town', NULL)
;

INSERT INTO football_events (markt_id, team_a_markt_id, team_b_markt_id, status, description, schema_id, event_datetime) VALUES
    (4361357, 180, 985, 'draft', 'Southampton FC vs Manchester United 4. Matchday | Sat, 9/14/24   |  1:30 PM', 1, '2024-09-14 13:30:00'),
    (4361352, 1237, 677, 'draft', 'Brighton & Hove Albion vs Ipswich Town 4. Matchday | Sat, 9/14/24   |  4:00 PM', 1, '2024-09-14 16:00:00'),
    (4361353, 873, 1003, 'draft', 'Crystal Palace vs Leicester City 4. Matchday | Sat, 9/14/24   |  4:00 PM', 1, '2024-09-14 16:00:00'),
    (4361354, 931, 379, 'draft', 'Fulham FC vs West Ham United 4. Matchday | Sat, 9/14/24   |  4:00 PM', 1, '2024-09-14 16:00:00'),
    (4361355, 31, 703, 'draft', 'Liverpool FC vs Nottingham Forest 4. Matchday | Sat, 9/14/24   |  4:00 PM', 1, '2024-09-14 16:00:00'),
    (4361356, 281, 1148, 'draft', 'Manchester City vs Brentford FC 4. Matchday | Sat, 9/14/24   |  4:00 PM', 1, '2024-09-14 16:00:00'),
    (4361351, 405, 29, 'draft', 'Aston Villa vs Everton FC 4. Matchday | Sat, 9/14/24   |  6:30 PM', 1, '2024-09-14 18:30:00'),
    (4361350, 989, 631, 'draft', 'AFC Bournemouth vs Chelsea FC 4. Matchday | Sat, 9/14/24   |  9:00 PM', 1, '2024-09-14 21:00:00'),
    (4361358, 148, 11, 'draft', 'Tottenham Hotspur vs Arsenal FC 4. Matchday | Sun, 9/15/24   |  3:00 PM', 1, '2024-09-15 15:00:00'),
    (4361359, 543, 762, 'draft', 'Wolverhampton Wanderers vs Newcastle United 4. Matchday | Sun, 9/15/24   |  5:30 PM', 1, '2024-09-15 17:30:00')
;