mod api_connect;
mod historical;

use api_connect::api_connect_impl;
use historical::historical_derive_impl;
use proc_macro::TokenStream;

#[proc_macro_derive(Historical)]
pub fn historical_derive(input: TokenStream) -> TokenStream {
    historical_derive_impl(input)
}

#[proc_macro_derive(ApiConnect)]
pub fn api_connect_derive(input: TokenStream) -> TokenStream {
    api_connect_impl(input)
}
