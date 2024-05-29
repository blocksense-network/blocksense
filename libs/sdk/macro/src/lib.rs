use proc_macro::TokenStream;
use quote::quote;

const WIT_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../wit");

/// Generates the entrypoint to a Blocksense Oracle component written in Rust.
#[proc_macro_attribute]
pub fn oracle_component(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let func = syn::parse_macro_input!(item as syn::ItemFn);
    let func_name = &func.sig.ident;
    let preamble = preamble();
    let await_postfix = func.sig.asyncness.map(|_| quote!(.await));

    quote!(
        #func
        mod __blocksense_oracle {
            mod preamble {
                #preamble
            }
            impl self::preamble::Guest for preamble::BlocksenseOracle {
                fn handle_oracle_request(payload: self::preamble::blocksense::oracle::oracle_types::Settings) -> Result<(self::preamble::blocksense::oracle::oracle_types::Payload), self::preamble::blocksense::oracle::oracle_types::Error> {
                    ::blocksense_sdk::spin::http::run(async move {
                        match super::#func_name(payload.try_into().expect("cannot convert from Blocksense Oracle settings"))#await_postfix {
                            Ok(payload) => Ok(payload.try_into().expect("cannot convert from Blocksense Oracle payload")),
                            Err(e) => {
                                eprintln!("{}", e);
                                Err(self::preamble::blocksense::oracle::oracle_types::Error::Other("err".to_string()))
                            },
                        }
                    })
                }
            }
            impl From<self::preamble::blocksense::oracle::oracle_types::Settings> for ::blocksense_sdk::oracle::Settings {
                fn from(settings: self::preamble::blocksense::oracle::oracle_types::Settings) -> Self {
                    Self { id: settings.id }
                }
            }


            impl From<::blocksense_sdk::oracle::Payload> for self::preamble::blocksense::oracle::oracle_types::Payload {
                fn from(payload: ::blocksense_sdk::oracle::Payload) -> Self {
                    Self { body: payload.body }
                }
            }
        }
    )
        .into()
}

fn preamble() -> proc_macro2::TokenStream {
    let world = "blocksense-oracle";
    quote! {
        #![allow(missing_docs)]
        ::blocksense_sdk::wit_bindgen::generate!({
            world: #world,
            path: #WIT_PATH,
            exports: {
                world: BlocksenseOracle
            }
        });
        pub struct BlocksenseOracle;
    }
}
