extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

pub fn historical_derive_impl(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let expanded = quote! {
        impl Historical for #name {
            fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: Timestamp) {
                self.history_buffer().push_overwrite((response, timestamp));
            }

            fn history_buffer(&mut self) -> &mut SharedRb<Heap<(Box<dyn Payload>, Timestamp)>> {
                &mut self.history_buffer
            }
        }
    };

    TokenStream::from(expanded)
}
