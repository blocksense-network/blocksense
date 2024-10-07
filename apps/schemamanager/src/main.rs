#![allow(unused_imports)]
#![allow(deprecated)]
#![allow(dead_code)]

// src/main.rs

use actix_web::http::header::ContentType;
use actix_web::rt::spawn;
use actix_web::web::Data;
use actix_web::{
    delete, error, get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use chrono::{DateTime, Duration, NaiveDateTime, TimeZone, Utc};
use futures_util::stream::FuturesUnordered;
use mysql_async::{prelude::*, Pool, Row, Value};
use reqwest::Client;
use schema_manager::common_function;
use serde::{Deserialize, Serialize};
use std::env;
use std::io::Error;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tracing::{info, info_span};
use utils::logging::{init_shared_logging_handle, SharedLoggingHandle}; // Import TimeZone for conversion

#[derive(Serialize)]
struct Name {
    name: String,
}

pub struct FeedManagerState {
    pub app_name: String,
    pub db_pool: Pool,
}

#[derive(Serialize, Deserialize, Debug)]
struct FootballEvent {
    event_id: Option<i32>,
    markt_id: i32,
    team_a_markt_id: i32,
    team_b_markt_id: i32,
    status: String,
    description: Option<String>,
    schema_id: Option<i32>,
    event_datetime: Option<String>,
}

#[derive(Deserialize)]
struct PublishEventRequest {
    markt_id: i32,
    voting_start_time: u128,  // New field for start time
    voting_end_time: u128,    // New field for end time
}


#[derive(Serialize, Deserialize)]
struct RegisterFeedRequest {
    name: String,
    schema_id: String,
    num_slots: u8, // Number of solidity slots needed for this schema
    repeatability: String,
    quorum_percentage: f32,
    voting_start_time: u128, // Milliseconds since EPOCH
    voting_end_time: u128,   // Milliseconds since EPOCH
}

#[get("/get_names")]
async fn get_names(data: web::Data<Arc<RwLock<FeedManagerState>>>) -> impl Responder {
    let pool = &data.read().await.db_pool;

    // Get a connection from the pool
    let mut conn = match pool.get_conn().await {
        Ok(conn) => conn,
        Err(_) => {
            return HttpResponse::InternalServerError().body("Failed to connect to the database")
        }
    };

    // Execute the query to fetch names
    let query = "SELECT name FROM feed_schemas";
    let result: Result<Vec<Name>, _> = conn.query_map(query, |name: String| Name { name }).await;

    match result {
        Ok(names) => HttpResponse::Ok().json(names),
        Err(_) => {
            HttpResponse::InternalServerError().body("Failed to fetch names from the database")
        }
    }
}

#[post("/football_events/add")]
async fn create_event(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    new_event: web::Json<FootballEvent>,
) -> impl Responder {
    let pool = &data.read().await.db_pool;
    let mut conn = pool
        .get_conn()
        .await
        .expect("Failed to connect to the database");

    let query = r#"
        INSERT INTO football_events (markt_id, team_a_markt_id, team_b_markt_id, status, description, schema_id, event_datetime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    "#;

    let result = conn
        .exec_drop(
            query,
            (
                new_event.markt_id,
                new_event.team_a_markt_id,
                new_event.team_b_markt_id,
                new_event.status.clone(),
                new_event.description.clone(),
                new_event.schema_id,
                new_event.event_datetime.clone(),
            ),
        )
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().body("Event created successfully"),
        Err(_) => HttpResponse::InternalServerError().body("Failed to create event"),
    }
}

#[get("/football_events/get/{event_id}")]
async fn get_event_by_id(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let event_id = path.into_inner().0;
    let pool = &data.read().await.db_pool;
    let mut conn = pool
        .get_conn()
        .await
        .expect("Failed to connect to the database");

    let query = r#"
        SELECT id, markt_id, team_a_markt_id, team_b_markt_id, status, description, schema_id, event_datetime
        FROM football_events
        WHERE id = ?
    "#;

    let row: Option<Row> = conn
        .exec_first(query, (event_id,))
        .await
        .expect("Failed to retrieve event");

    if let Some(row) = row {
        let _id: i32 = row.get(0).unwrap();
        let markt_id: i32 = row.get(1).unwrap();
        let team_a_markt_id: i32 = row.get(2).unwrap();
        let team_b_markt_id: i32 = row.get(3).unwrap();
        let status: String = row.get(4).unwrap();
        let description: Option<String> = row.get(5);
        let schema_id: Option<i32> = row.get(6);

        let event_datetime_str: Option<String> = row.get(7);
        let event_datetime = match event_datetime_str {
            Some(datetime_str) => NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %H:%M:%S")
                .unwrap_or_else(|_| NaiveDateTime::from_timestamp(0, 0)), // Default value if parsing fails
            None => NaiveDateTime::from_timestamp(0, 0), // Default value if the field is None
        };

        let event = FootballEvent {
            event_id: Some(event_id),
            markt_id,
            team_a_markt_id,
            team_b_markt_id,
            status,
            description,
            schema_id,
            event_datetime: Some(event_datetime.to_string()),
        };

        HttpResponse::Ok().json(event)
    } else {
        HttpResponse::NotFound().body("Event not found")
    }
}

#[post("/football_events/update/{id}")]
async fn update_event(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    path: web::Path<(i32,)>,
    updated_event: web::Json<FootballEvent>,
) -> impl Responder {
    let id = path.into_inner().0;
    let pool = &data.read().await.db_pool;
    let mut conn = pool
        .get_conn()
        .await
        .expect("Failed to connect to the database");

    let query = r#"
        UPDATE football_events
        SET markt_id = ?, team_a_markt_id = ?, team_b_markt_id = ?, status = ?, description = ?, schema_id = ?, event_datetime = ?
        WHERE id = ?
    "#;

    let result = conn
        .exec_drop(
            query,
            (
                updated_event.markt_id,
                updated_event.team_a_markt_id,
                updated_event.team_b_markt_id,
                updated_event.status.clone(),
                updated_event.description.clone(),
                updated_event.schema_id,
                updated_event.event_datetime.clone(),
                id,
            ),
        )
        .await;

    match result {
        Ok(_) => HttpResponse::Ok().body("Event updated successfully"),
        Err(_) => HttpResponse::InternalServerError().body("Failed to update event"),
    }
}

#[post("/football_events/delete/{id}")]
async fn delete_event(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let id = path.into_inner().0;
    let pool = &data.read().await.db_pool;
    let mut conn = pool
        .get_conn()
        .await
        .expect("Failed to connect to the database");

    let query = "DELETE FROM football_events WHERE id = ?";
    let result = conn.exec_drop(query, (id,)).await;

    match result {
        Ok(_) => HttpResponse::Ok().body("Event deleted successfully"),
        Err(_) => HttpResponse::InternalServerError().body("Failed to delete event"),
    }
}

#[get("/football_events/after/{datetime}")]
async fn get_events_after_datetime(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    path: web::Path<(String,)>,
) -> impl Responder {
    let datetime_str = path.into_inner().0;
    let pool = &data.read().await.db_pool;
    let mut conn = pool
        .get_conn()
        .await
        .expect("Failed to connect to the database");

    // Convert the input datetime string to `NaiveDateTime`
    let event_datetime = match NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S") {
        Ok(dt) => dt,
        Err(_) => return HttpResponse::BadRequest().body("Invalid datetime format"),
    };

    // Convert `NaiveDateTime` to a format compatible with MySQL
    let event_datetime_for_db = event_datetime.format("%Y-%m-%d %H:%M:%S").to_string();

    // Query the database for all events after the given datetime
    let query = r#"
        SELECT id, markt_id, team_a_markt_id, team_b_markt_id, status, description, schema_id, event_datetime
        FROM football_events
        WHERE event_datetime > ?
    "#;

    let events: Vec<FootballEvent> = conn
        .exec_map(query, (event_datetime_for_db,), |row: mysql_async::Row| {
            let id: i32 = row.get(0).unwrap();
            let markt_id: i32 = row.get(1).unwrap();
            let team_a_markt_id: i32 = row.get(2).unwrap();
            let team_b_markt_id: i32 = row.get(3).unwrap();
            let status: String = row.get(4).unwrap();
            let description: Option<String> = row.get(5);
            let schema_id: Option<i32> = row.get(6);

            // Handle the event datetime field
            let event_datetime_str: Option<String> = row.get(7);
            let event_datetime = match event_datetime_str {
                Some(datetime_str) => {
                    NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %H:%M:%S")
                        .unwrap_or_else(|_| NaiveDateTime::from_timestamp(0, 0))
                }
                None => NaiveDateTime::from_timestamp(0, 0),
            };

            FootballEvent {
                event_id: Some(id),
                markt_id,
                team_a_markt_id,
                team_b_markt_id,
                status,
                description,
                schema_id,
                event_datetime: Some(event_datetime.to_string()),
            }
        })
        .await
        .expect("Failed to execute query");

    HttpResponse::Ok().json(events)
}

#[derive(Serialize, Deserialize)]
struct RegisterFeedResponse {
    feed_id: String, // Assuming the response contains a `feed_id` field
}

/*
curl -X POST http://localhost:1337/football_events/publish \
     -H "Content-Type: application/json" \
     -d '{"markt_id": 4361359, "voting_start_time": 1704067200000, "voting_end_time": 1735689599999}'
 */
/// Publish a football event by markt_id.
///
/// # Example
///
/// curl -X POST http://localhost:1337/football_events/publish \
///      -H "Content-Type: application/json" \
///      -d '{"markt_id": 4361359, "voting_start_time": 1704067200000, "voting_end_time": 1735689599999}'
///
/// This endpoint updates the status of the event to 'published' and
/// registers the feed by calling the sequencer service.
///
/// In this example, `voting_start_time` is set to the beginning of 2024 (January 1, 2024) and
/// `voting_end_time` is set to the end of 2024 (December 31, 2024).
#[post("/football_events/publish")]
async fn publish_event(
    data: web::Data<Arc<RwLock<FeedManagerState>>>,
    publish_request: web::Json<PublishEventRequest>,
) -> impl Responder {
    let markt_id = publish_request.markt_id;

    // Extract voting times from the request
    // let voting_start_time = publish_request.voting_start_time;
    let now = Utc::now();
    let voting_start_time = (now + Duration::seconds(10)).timestamp_millis() as u128;
    // let voting_end_time = publish_request.voting_end_time;
    let voting_end_time = (now + Duration::minutes(10)).timestamp_millis() as u128;

    let pool = &data.read().await.db_pool;
    let mut conn = match pool.get_conn().await {
        Ok(conn) => conn,
        Err(_) => return HttpResponse::InternalServerError().body("Failed to connect to the database"),
    };

    // Update the event's status to 'published'
    let query = r#"
        UPDATE football_events
        SET status = 'published'
        WHERE markt_id = ?
    "#;
    if let Err(_) = conn.exec_drop(query, (markt_id,)).await {
        return HttpResponse::InternalServerError().body("Failed to update event status");
    }

    // Retrieve event details
    let select_query = r#"
        SELECT id, schema_id
        FROM football_events
        WHERE markt_id = ?
    "#;

    let row: Option<Row> = match conn.exec_first(select_query, (markt_id,)).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::InternalServerError().body("Failed to retrieve event"),
    };

    if let Some(row) = row {
        // Extract values from the row
        let _id: i32 = row.get(0).unwrap();
        let schema_id: i32 = row.get(1).unwrap();

        // Prepare the register request
        // Reassign voting_start_time to be the current time + 10 seconds

        let register_request = RegisterFeedRequest {
            name: format!("Football Event {}", markt_id),
            schema_id: schema_id.to_string(),
            num_slots: 1,
            repeatability: String::from("event_feed"),
            quorum_percentage: 50.0,
            voting_start_time,
            voting_end_time,
        };

        // Send request to the Sequencer
        let sequencer_url = "http://localhost:8877/feed/register"; // Replace with the actual Sequencer URL
        let client = Client::new();
        let sequencer_response = match client.post(sequencer_url).json(&register_request).send().await {
            Ok(response) => response,
            Err(_) => return HttpResponse::InternalServerError().body("Failed to call Sequencer"),
        };

        let status = sequencer_response.status(); // Extract the status before calling `.text()`
        let body = sequencer_response
            .text()
            .await
            .unwrap_or_else(|_| "Failed to read response body".to_string());

        if status.is_success() {
            let register_feed_response: RegisterFeedResponse = match serde_json::from_str(&body) {
                Ok(json) => json,
                Err(_) => return HttpResponse::InternalServerError().body("Invalid feed response"),
            };

            // Update the football_events table with feed_id, voting_start_time, and voting_end_time
            let update_query = r#"
                UPDATE football_events
                SET feed_id = ?, voting_start_time = ?, voting_end_time = ?
                WHERE markt_id = ?
            "#;
            // Execute the update query and print the result
            match conn
                .exec_drop(
                    update_query,
                    (
                        register_feed_response.feed_id,
                        voting_start_time as i64, // Store as BIGINT
                        voting_end_time as i64,   // Store as BIGINT
                        markt_id,
                    ),
                )
                .await
            {
                Ok(_) => {
                    HttpResponse::Ok().body(format!("Event {} published and registered", markt_id))
                }
                Err(e) => {
                    HttpResponse::InternalServerError().body("Failed to update feed_id and voting times")
                }
            }
        } else {
            HttpResponse::InternalServerError().body(format!(
                "Failed to register feed: {}. Response: {}",
                status,
                body
            ))
        }
    } else {
        HttpResponse::NotFound().body("Event not found")
    }
}



#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init(); // Enable logging
    let database_url = "mysql://root:@localhost:3306/blockschemas";
    let pool = Pool::new(database_url);
    let app_state = Arc::new(RwLock::new(FeedManagerState {
        app_name: String::from("some_app_name"),
        db_pool: pool,
    }));
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(app_state.clone())) // Wrap app_state in Data::new()
            .service(publish_event)
    })
    .bind(("0.0.0.0", 1337))?
    .run()
    .await
}
