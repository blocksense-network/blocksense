use mysql::prelude::*;
use mysql::*;
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::error::Error;
use std::thread;
use std::time::Duration;

#[derive(Debug)]
struct MatchInfo {
    date: String,
    match_id: String,
    time: String,
    home_team_id: String,
    away_team_id: String,
    description: String,
}

// Function that fetches, parses, and writes match data to the database
fn fetch_and_store_match_data() -> Result<(), Box<dyn Error>> {
    // The URL of the webpage
    let url = "https://www.transfermarkt.com/premier-league/startseite/wettbewerb/GB1";

    // Fetch the webpage
    let client = Client::new();
    let response = client.get(url).send()?.text()?;

    // Parse the HTML content using scraper
    let document = Html::parse_document(&response);

    // Selector for the div with id 'spieltagtabs-3'
    let div_selector = Selector::parse("#spieltagtabs-3").unwrap();

    // Find the div element
    let spieltag_div = document.select(&div_selector).next();

    // Selector for the 'tr' rows which contain each match
    let row_selector = Selector::parse("tr.begegnungZeile").unwrap();

    // Selector for the 'a' tags with the title "To the preview"
    let preview_link_selector = Selector::parse("a[title='To the preview']").unwrap();

    // Selector for the 'img' tags within the 'verein-heim' and 'verein-gast'
    let img_selector = Selector::parse("img").unwrap();

    // Selector for the date
    let date_selector = Selector::parse("td.zeit.al span.spielzeitpunkt a").unwrap();

    // Selector for the time span inside 'a[title="To the preview"]'
    let time_selector = Selector::parse("span").unwrap();

    // Selector for the team names
    let home_team_name_selector = Selector::parse("td.verein-heim span.vereinsname a").unwrap();
    let away_team_name_selector = Selector::parse("td.verein-gast span.vereinsname a").unwrap();

    // Track the last known date
    let mut last_known_date = String::new();

    // List to hold match info
    let mut matches: Vec<MatchInfo> = Vec::new();

    if let Some(div) = spieltag_div {
        // Iterate over each match row
        for row in div.select(&row_selector) {
            // Check if this row defines a new date
            if let Some(date_element) = row.select(&date_selector).next() {
                if let Some(href) = date_element.value().attr("href") {
                    if let Some(date) = href.split('/').last() {
                        last_known_date = date.to_string();
                    }
                }
            }

            // Extract the match ID from the "a" element with title="To the preview"
            if let Some(preview_link) = row.select(&preview_link_selector).next() {
                if let Some(href) = preview_link.value().attr("href") {
                    if let Some(match_id) = href.split('/').last() {
                        // Extract the home and away team names
                        let home_team_name = row
                            .select(&home_team_name_selector)
                            .next()
                            .map_or("Unknown home team".to_string(), |a| {
                                a.text().collect::<Vec<_>>().concat()
                            });

                        let away_team_name = row
                            .select(&away_team_name_selector)
                            .next()
                            .map_or("Unknown away team".to_string(), |a| {
                                a.text().collect::<Vec<_>>().concat()
                            });

                        // Extract the home team ID from the img tag in 'verein-heim'
                        let home_team_td = row.select(&img_selector).nth(0); // First img is for the home team
                        let away_team_td = row.select(&img_selector).nth(1); // Second img is for the away team

                        if let (Some(home_team_img), Some(away_team_img)) =
                            (home_team_td, away_team_td)
                        {
                            let home_team_src = home_team_img.value().attr("src").unwrap_or("");
                            let away_team_src = away_team_img.value().attr("src").unwrap_or("");

                            let home_team_id = extract_team_id_from_src(home_team_src);
                            let away_team_id = extract_team_id_from_src(away_team_src);

                            // Extract the match time from the span inside the 'a[title="To the preview"]'
                            let match_time = preview_link
                                .select(&time_selector)
                                .next()
                                .map_or("Unknown time".to_string(), |span| {
                                    span.text().collect::<Vec<_>>().concat()
                                });

                            // Create a description string
                            let description = format!(
                                "{} vs {} | {} | {}",
                                home_team_name, away_team_name, last_known_date, match_time
                            );

                            // Create a MatchInfo struct and add it to the list
                            let match_info = MatchInfo {
                                date: last_known_date.clone(),
                                match_id: match_id.to_string(),
                                time: match_time.clone(),
                                home_team_id: home_team_id.clone(),
                                away_team_id: away_team_id.clone(),
                                description: description.clone(),
                            };
                            matches.push(match_info);

                            // Print the match info
                            println!(
                                "Date: {}, Match ID: {}, Time: {}, Home team ID: {}, Away team ID: {}, Description: {}",
                                last_known_date, match_id, match_time, home_team_id, away_team_id, description
                            );
                        }
                    }
                }
            }
        }
    } else {
        println!("Div with id 'spieltagtabs-3' not found.");
    }

    // Database URL
    let database_url = "mysql://root:@localhost:3306/blockschemas";
    let pool = Pool::new(database_url)?;
    let mut conn = pool.get_conn()?;

    // Insert the collected data into the database
    for match_info in matches {
        conn.exec_drop(
            r"INSERT IGNORE INTO football_events (markt_id, team_a_markt_id, team_b_markt_id, status, event_datetime, description, schema_id)
              VALUES (:match_id, :home_team_id, :away_team_id, 'draft', :event_datetime, :description, 1)",
            params! {
                "match_id" => match_info.match_id,
                "home_team_id" => match_info.home_team_id,
                "away_team_id" => match_info.away_team_id,
                "event_datetime" => format!("{} {}", match_info.date, match_info.time),
                "description" => match_info.description,
            },
        )?;
    }

    Ok(())
}

// Helper function to extract the team ID from the img src URL
fn extract_team_id_from_src(src: &str) -> String {
    let filename = src.split('/').last().unwrap_or("");
    filename.split('.').next().unwrap_or("").to_string()
}

// Main function to run the fetch-and-store logic every minute
fn main() -> Result<(), Box<dyn Error>> {
    loop {
        // Call the fetch and store function
        if let Err(e) = fetch_and_store_match_data() {
            eprintln!("Error: {:?}", e);
        }

        // Sleep for 1 minute
        thread::sleep(Duration::from_secs(60));
    }
}
