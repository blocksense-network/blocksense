mod historical;

use historical::historical_derive_impl;
use proc_macro::TokenStream;

#[proc_macro_derive(Historical)]
pub fn historical_derive(input: TokenStream) -> TokenStream {
    historical_derive_impl(input)
}
