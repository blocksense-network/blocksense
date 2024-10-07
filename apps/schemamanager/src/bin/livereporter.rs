use mysql::prelude::*;
use mysql::*;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde_json::Value;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use chrono::{NaiveDateTime, Datelike}; // Import chrono for date formatting
use ethers::abi::{Token, encode_packed};
use serde::{Serialize, Deserialize};


// Struct to hold match data from live score
#[derive(Debug, Clone)]
struct MatchInfo {
    eid: String,
    esd: String, // This represents the event date in yyyymmdd format
    home_team: String,
    away_team: String,
}

// Struct to hold football events from the database
#[derive(Debug, Clone)]
#[allow(dead_code)]
struct FootballEvent {
    id: i32,
    markt_id: i32,
    home_team: String,
    away_team: String,
    voting_end_time: i64, // Stored as BIGINT (milliseconds)
    event_datetime: NaiveDateTime, // Using chrono's NaiveDateTime to store the event datetime
    description: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct DataFeedPayload {
    payload_metadata: PayloadMetaData,
    result: FeedResult,
}

#[derive(Serialize, Deserialize, Debug)]
struct PayloadMetaData {
    reporter_id: u64,
    feed_id: String,
    timestamp: u64,
    signature: String,  // Signature string
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum FeedResult {
    Result { result: FeedType },
    Error { error: FeedError },
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub enum FeedType {
    Numerical(f64),
    Text(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeedError {
    APIError(String),

    UndefinedError,
}


// Function that fetches and returns match data from the live score page
fn fetch_and_store_match_data() -> Result<Vec<MatchInfo>, Box<dyn Error>> {
    let url = "https://www.livescore.com/en/football/england/premier-league/results/";

    // Fetch the webpage
    let client = Client::new();
    let response = client.get(url).send()?.text()?;

    // Parse the HTML content using scraper
    let document = Html::parse_document(&response);

    // Select the <script> tag with id "__NEXT_DATA__"
    let selector = Selector::parse(r#"script[id="__NEXT_DATA__"]"#).unwrap();
    let script_content = document
        .select(&selector)
        .next()
        .ok_or("Script tag not found")?
        .inner_html();

    // Parse the JSON inside the script tag
    let json: Value = serde_json::from_str(&script_content)?;

    // Navigate the JSON structure to find the "Events" array
    let events = json["props"]["pageProps"]["initialStageData"]["stages"][0]["Events"]
        .as_array()
        .ok_or("Events array not found")?;

    // Extract relevant match data
    let mut match_infos: Vec<MatchInfo> = Vec::new();
    for event in events {
        if let (Some(eid), Some(esd), Some(t1), Some(t2)) = (
            event["Eid"].as_str(),
            event["Esd"].as_i64(),  // Use as_i64() to handle Esd as a number
            event["T1"][0]["Nm"].as_str(),
            event["T2"][0]["Nm"].as_str(),
        ) {
            let match_info = MatchInfo {
                eid: eid.to_string(),
                esd: esd.to_string(),  // Convert the number to a string if necessary
                home_team: t1.to_string(),
                away_team: t2.to_string(),
            };
            match_infos.push(match_info);
        }
    }

    // Return the extracted match data
    Ok(match_infos)
}

fn get_upcoming_published_events(pool: &Pool) -> Result<Vec<FootballEvent>, Box<dyn Error>> {
    let mut conn = pool.get_conn()?;

    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis() as i64; // Get the current time in milliseconds

    let query = r#"
        SELECT id, markt_id, team_a_markt_id, team_b_markt_id, voting_end_time, event_datetime, description
        FROM football_events
        WHERE voting_end_time > ?
    "#;

    let rows: Vec<FootballEvent> = conn.exec_map(
        query,
        (current_time,),
        |(id, markt_id, team_a_markt_id, team_b_markt_id, voting_end_time, event_datetime, description): (i32, i32, i32, i32, i64, NaiveDateTime, String)| FootballEvent {
            id,
            markt_id,
            home_team: team_a_markt_id.to_string(),  // Convert to String
            away_team: team_b_markt_id.to_string(),  // Convert to String
            voting_end_time,
            event_datetime, // No need to parse it as it's already NaiveDateTime
            description,
        },
    )?;

    Ok(rows)
}



// Function to find matches from live score that correspond to open events in the database
// fn find_finished_matches_with_open_votes(
//     match_infos: Vec<MatchInfo>,
//     upcoming_events: Vec<FootballEvent>,
// ) -> Vec<MatchInfo> {
//     let mut finished_matches_with_open_votes: Vec<MatchInfo> = Vec::new();
//
//     for match_info in match_infos {
//         for event in &upcoming_events {
//             if check_if_same_event(&match_info, event) {
//                 // Found a match that has an open vote in the database
//                 finished_matches_with_open_votes.push(match_info);
//                 break; // Break to avoid multiple additions for the same match
//             }
//         }
//     }
//
//     finished_matches_with_open_votes
// }

fn find_finished_matches_with_open_votes(
    match_infos: Vec<MatchInfo>,
    upcoming_events: Vec<FootballEvent>,  // This takes owned values
) -> Vec<(MatchInfo, FootballEvent)> {    // This returns owned values
    let mut finished_matches_with_open_votes: Vec<(MatchInfo, FootballEvent)> = Vec::new();

    for match_info in match_infos {
        for event in &upcoming_events {
            if check_if_same_event(&match_info, event) {
                // Explicitly clone the MatchInfo and FootballEvent
                let match_info_cloned = match_info.clone();
                let event_cloned = event.clone();

                // Add the cloned objects to the vector
                finished_matches_with_open_votes.push((match_info_cloned, event_cloned));
                break; // Break to avoid multiple additions for the same match
            }
        }
    }

    finished_matches_with_open_votes
}


// Function to check if a match from live score and a football event from the database represent the same event
fn check_if_same_event(match_info: &MatchInfo, event: &FootballEvent) -> bool {
    // Convert event_datetime from FootballEvent to the yyyymmdd format
    let event_date_str = format!(
        "{:04}{:02}{:02}",
        event.event_datetime.year(),
        event.event_datetime.month(),
        event.event_datetime.day()
    );

    // Extract first 5 characters from home_team and away_team
    let match_info_home_team_part = &match_info.home_team[..5.min(match_info.home_team.len())];
    let match_info_away_team_part = &match_info.away_team[..5.min(match_info.away_team.len())];

    // Convert both parts and event description to lowercase for case-insensitive comparison
    let lower_home_team_part = match_info_home_team_part.to_lowercase();
    let lower_away_team_part = match_info_away_team_part.to_lowercase();
    let lower_description = event.description.to_lowercase();

    // Check if both home_team and away_team parts are contained in the description
    let home_team_in_description = lower_description.contains(&lower_home_team_part);
    let away_team_in_description = lower_description.contains(&lower_away_team_part);

    // Compare the event date and check if both home_team and away_team are contained in the description
    home_team_in_description
        && away_team_in_description
        && match_info.esd.starts_with(&event_date_str)
}

#[derive(Debug)]
struct FootballData {
    home_score: u32,
    away_score: u32,
    home_shots: u32,
    away_shots: u32,
    home_penalties: u32,
    away_penalties: u32,
    home_saves: u32,
    away_saves: u32,
    home_first_half_time_score: u32,
    away_first_half_time_score: u32,
}


// Function to encode a FootballData struct into ABI-packed bytes
fn encode_football_event(event: FootballData) -> Result<Vec<u8>, Box<dyn Error>> {
    // Convert each field in the FootballData struct into an ABI-compatible Token
    let tokens: Vec<Token> = vec![
        Token::Uint(event.home_score.into()),
        Token::Uint(event.away_score.into()),
        Token::Uint(event.home_shots.into()),
        Token::Uint(event.away_shots.into()),
        Token::Uint(event.home_penalties.into()),
        Token::Uint(event.away_penalties.into()),
        Token::Uint(event.home_saves.into()),
        Token::Uint(event.away_saves.into()),
        Token::Uint(event.home_first_half_time_score.into()),
        Token::Uint(event.away_first_half_time_score.into()),
    ];

    // ABI-packed encoding using ethers-core's encode_packed function
    let encoded = encode_packed(&tokens)?;

    Ok(encoded)
}

#[derive(Serialize, Deserialize, Debug)]
struct ReportPayload {
    feed_id: u32,
    reporter_id: String,
    result: Vec<u8>,  // Encoded result as a byte array
    signature: String,  // Signature string
    timestamp: u64,     // Current timestamp in milliseconds
}

// Utility function to convert Vec<u8> to a hexadecimal string
fn bytes_to_hex_string(bytes: Vec<u8>) -> String {
    bytes.into_iter().map(|byte| format!("{:02x}", byte)).collect::<Vec<String>>().join("")
}

fn main() {
    // Set up database connection pool
    let url = "mysql://root:@localhost:3306/blockschemas"; // Replace with your actual database URL
    let pool = Pool::new(url).expect("Failed to create database connection pool");

    // Fetch live score matches
    match fetch_and_store_match_data() {
        Ok(match_infos) => {
            // Fetch upcoming published events with open votes from the database
            match get_upcoming_published_events(&pool) {
                Ok(upcoming_events) => {
                    // Find finished matches that have open votes
                    let finished_matches_with_open_votes =
                        find_finished_matches_with_open_votes(match_infos, upcoming_events);

                    // Iterate over the finished_matches_with_open_votes
                    for (_, football_event) in finished_matches_with_open_votes.iter() {
                        // Print the markt_id from the FootballEvent
                    }

                    // Prepare and send a request to the /post_report endpoint for each match
                    let client = Client::new();
                    let sequencer_url = "http://localhost:8877/post_report";

                    for (match_info, event) in finished_matches_with_open_votes {
                        // Replace these placeholder values with actual match data extraction logic
                        let football_data = FootballData {
                            home_score: 2,  // Example data, replace with actual logic
                            away_score: 1,
                            home_shots: 10,
                            away_shots: 8,
                            home_penalties: 1,
                            away_penalties: 0,
                            home_saves: 3,
                            away_saves: 5,
                            home_first_half_time_score: 1,
                            away_first_half_time_score: 1,
                        };

                        // Encode the FootballData struct
                        let encoded_result = match encode_football_event(football_data) {
                            Ok(encoded) => encoded,
                            Err(err) => {
                                eprintln!("Failed to encode football data for match {}: {:?}", match_info.eid, err);
                                continue;  // Skip to the next match in case of an error
                            }
                        };
                        // Convert the encoded result (Vec<u8>) to a hexadecimal string
                        let result_as_string = bytes_to_hex_string(encoded_result);

                        // Construct the FeedResult using the encoded result as a Text
                        let result = FeedResult::Result {
                            result: FeedType::Text(result_as_string),
                        };

                        // Prepare the payload metadata
                        let payload_metadata = PayloadMetaData {
                            reporter_id: 123,  // Replace with the actual reporter ID
                            feed_id: "1".to_string(),  // Example feed ID
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .expect("Time went backwards")
                                .as_millis() as u64,
                            signature: "0d81fa97397f6e94edc447c19bf54272ab9243e201c7b34ab5fd41c656015f61bd3b5aeb68f62b903a92f4164304801e07d95c34a860ca8376be0e2cb0772c9a2072face6d6ec869e554ad6014e52622a6fabf799e7785f36f23d3ad69c9f60601ca85fc5b9cbdf5ef806b96995c62da75b0ea8503d2d3c63280fa8087bdf91d297366214013f2cd4b7a7fa8c582abc21346e337bfa9f67c4e823252ae6c2c8db3319fe09dc5a188b15812024b0ec4a54db3bdbfb74d7fcae5614f1c0d86e9a0".to_string(),  // Replace with actual signature
                        };

                        // Create the DataFeedPayload
                        let payload = DataFeedPayload {
                            payload_metadata,
                            result,
                        };

                        let serialized_payload = match serde_json::to_value(&payload) {
                            Ok(payload) => payload,
                            Err(_) => panic!("Failed serialization of payload!"),
                        };

                        let payload_as_string = serialized_payload.to_string();

                        // Send the serialized payload to the sequencer
                        let response = client
                            .post(sequencer_url)
                            .header("Content-Type", "application/json")
                            .body(payload_as_string)
                            .send();

                        // Print the result of the request
                        match response {
                            Ok(resp) => println!("Report sent for match {}: {}", match_info.eid, resp.status()),
                            Err(err) => eprintln!("Failed to send report for match {}: {:?}", match_info.eid, err),
                        }
                    }
                }
                Err(err) => eprintln!("Error fetching upcoming events: {:?}", err),
            }
        }
        Err(err) => eprintln!("Error fetching match data: {:?}", err),
    }
}
