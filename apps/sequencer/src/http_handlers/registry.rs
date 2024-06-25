use eyre::Result;

use super::super::feeds::feeds_state::FeedsState;
use actix_multipart::Multipart;
use actix_web::error::ErrorBadRequest;
use actix_web::http::header::ContentType;
use actix_web::{error, Error};
use actix_web::{get, web};
use actix_web::{post, HttpResponse};
use futures::StreamExt;

const MAX_PLUGIN_SIZE: usize = 1_000_000; // max payload size is 900kb

/// Uploads a WebAssembly plugin to the registry.
///
/// This endpoint accepts a multipart/form-data POST request with the following fields:
/// - `name`: The name of the plugin (string).
/// - `namespace`: The namespace of the plugin (string).
/// - `wasm`: The WebAssembly file to be uploaded (file, max size 1MB).
///
/// Example `curl` request:
/// ```sh
/// curl -X POST http://localhost:8877/registry/plugin/upload \
///   -F "name=plugin_name" \
///   -F "namespace=plugin_namespace" \
///   -F "wasm=@path/to/your/file.wasm"
/// ```
///
/// # Errors
/// Returns HTTP 400 if any of the fields are missing or if the file size exceeds the limit.
#[post("/registry/plugin/upload")]
async fn registry_plugin_upload(
    mut payload: Multipart,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    println!("Called registry_plugin_upload");

    let mut name = String::new();
    let mut namespace = String::new();
    let mut wasm_file = None;

    while let Some(Ok(mut field)) = payload.next().await {
        let field_name = field.name();

        if field_name == "name" {
            while let Some(chunk) = field.next().await {
                name.push_str(&String::from_utf8(chunk?.to_vec()).unwrap());
            }
        } else if field_name == "namespace" {
            while let Some(chunk) = field.next().await {
                namespace.push_str(&String::from_utf8(chunk?.to_vec()).unwrap());
            }
        } else if field_name == "wasm" {
            let mut file_bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                let chunk = chunk?;
                if (file_bytes.len() + chunk.len()) > MAX_PLUGIN_SIZE {
                    return Err(error::ErrorBadRequest("File size exceeds the limit of 1MB"));
                }
                file_bytes.extend_from_slice(&chunk);
            }
            wasm_file = Some(file_bytes);
        }
    }

    // TODO (Dilyan Dokov): Validate name, namespace and wasm present. Return http 400 otherwise.
    // TODO (Dilyan Dokov): Sanitize string for dangerous characters
    {
        let mut reg = app_state
            .plugin_registry
            .write()
            .unwrap_or_else(|poisoned| {
                // Handle mutex poisoning
                let guard = poisoned.into_inner();
                guard
            });
        let registry_key = format!("{}:{}", namespace, name);
        if wasm_file.is_none() {
            return Err(ErrorBadRequest("No file sent"));
        }
        let wasm_file_bytes = wasm_file.unwrap();
        reg.insert(registry_key, wasm_file_bytes.to_vec())
            .map_err(|_e| ErrorBadRequest("Plugin registry capacity reached"))?;
        // Releasing plugin_registry rwlock
    }

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(""))
}

/// Retrieves a WebAssembly plugin from the registry.
///
/// This endpoint accepts a GET request with the following path parameters:
/// - `namespace`: The namespace of the plugin (string).
/// - `name`: The name of the plugin (string).
///
/// Example `curl` request:
/// ```sh
/// curl -X GET "http://localhost:8877/registry/plugin/get/plugin_namespace/plugin_name" -o downloaded_plugin.wasm
/// ```
///
/// # Errors
/// Returns HTTP 404 if the specified plugin is not found.
#[get("/registry/plugin/get/{namespace}/{name}")]
async fn registry_plugin_get(
    path: web::Path<(String, String)>,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let (namespace, name) = path.into_inner();
    println!("Called registry_plugin_get {}:{}", namespace, name);

    let plugin_file;
    {
        let reg = app_state.plugin_registry.read().unwrap();
        let registry_key = format!("{}:{}", namespace, name);
        plugin_file = reg
            .get(&registry_key)
            .ok_or_else(|| actix_web::error::ErrorNotFound("Plugin not found"))?;

        Ok(HttpResponse::Ok()
            .content_type("application/wasm")
            .body(plugin_file.clone()))
    }
}

/// Retrieves the current memory usage of the plugin registry.
///
/// This endpoint accepts a GET request and returns the current memory usage in bytes.
///
/// Example `curl` request:
/// ```sh
/// curl -X GET http://localhost:8877/registry/plugin/size
/// ```
///
/// # Returns
/// - The current memory usage of the plugin registry in bytes as a plain text response.
#[get("/registry/plugin/size")]
async fn registry_plugin_size(app_state: web::Data<FeedsState>) -> Result<HttpResponse, Error> {
    println!("Called registry_plugin_size");
    let registry_size;
    {
        let reg = app_state.plugin_registry.write().unwrap();
        registry_size = reg.current_memory_usage;
    }
    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(registry_size.to_string()))
}
