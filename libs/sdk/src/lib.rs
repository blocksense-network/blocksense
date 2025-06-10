/// Exports the procedural macros for writing handlers for Spin components.
pub use blocksense_macro::*;

#[doc(hidden)]
/// Module containing wit bindgen generated code.
///
/// This is only meant for internal consumption.
pub mod wit {
    // #![allow(missing_docs)]

    // wit_bindgen::generate!({
    //     world: "platform",
    //     path: "./wit",
    // });
}

pub mod http;
pub mod oracle;
pub mod wap;

/// Export the traits for the Spin SDK.
pub mod traits;

pub use spin_sdk as spin;

#[doc(hidden)]
pub use wit_bindgen;

// #[doc(inline)]
// pub use wit::fermyon::spin::variables;
