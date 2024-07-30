extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

pub fn api_connect_impl(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let expanded = quote! {
        impl ApiConnect for #name {
            fn api(&self) -> &DataFeedAPI {
                &DataFeedAPI::#name
            }

            fn is_connected(&self) -> bool {
                self.is_connected
            }
        }
    };

    TokenStream::from(expanded)
}
