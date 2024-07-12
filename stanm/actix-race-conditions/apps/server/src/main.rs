// Description of the experiment
//
// This is my best effort to create a race condition in an actix handler. It required using an
// unsafe section and casting to raw pointers, as well as what is known as "const casting" in C++.
// This is good, because it gives me confidence in the thread safety the Rust compiler provides.
// Then again, maybe there's a way to reproduce the problem without an unsafe block, so there is no
// **proof** that you cannot shoot yourself in the foot in this way.
//
// This test is important, because it demonstrates that the actix server does indeed exhibit
// parallelism, so care needs to be taken when writing code that will be executed as part of a
// request handler. In order to disable parallelism in the server, pass `.workers(1)` to the return
// value of `HttpServer::new(...)`.
//
// To perform the experiment:
//
// 1. in one shell, start this program with `cargo run --bin server`
// 2. in a second shell, start the client program with `cargo run --bin client`
//
// What you should see: the client outputs:
//
// ```
// #requests sent: 1000
// #successful responses: 1000
// ```
//
// The server outputs a last message with "counter=997" or some other number less than 1000.
//
// If the handler was written in a safe manner, the last message from the server should say
// something like "counter=1000".
//
// The moral of the story is: take care for thread safety in request handler code.
use actix_web::{post, web, App, HttpRequest, HttpResponse, HttpServer};
use std::thread::current;

// This struct represents state
pub(crate) struct AppState {
    pub(crate) counter: usize,
}

/// A single POST endpoint, used for stress-testing thread-unsafe code.
#[post("/stress")]
#[allow(invalid_reference_casting)]
pub(crate) async fn stress(req: HttpRequest) -> HttpResponse {
    let app_data: &web::Data<AppState> = req.app_data().unwrap();
    // Note: app_data.counter += 1 does not work, because web::Data wraps AppState in an Arc.
    unsafe {
        let x: *mut usize = &app_data.counter as *const usize as *mut usize;
        *x += 1;
    }
    // This print will reported a counter that is less than the number of requests handled.
    println!("[{:?}] counter={}", current().id(), app_data.counter);
    HttpResponse::Ok().finish()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let app_state = web::Data::new(AppState { counter: 0 });

    let address = "127.0.0.1";
    let port = 8080;
    // Always tell the user where to find the server, so they don't need to read the code for that.
    println!("Running server at {address}:{port} with POST endpoint /stress");
    HttpServer::new(move || App::new().app_data(app_state.clone()).service(stress))
        .bind((address, port))?
        .run()
        .await
}
