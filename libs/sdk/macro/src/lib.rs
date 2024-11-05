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
                fn handle_oracle_request(settings: self::preamble::blocksense::oracle::oracle_types::Settings) -> Result<(self::preamble::blocksense::oracle::oracle_types::Payload), self::preamble::blocksense::oracle::oracle_types::Error> {
                    ::blocksense_sdk::spin::http::run(async move {
                        match super::#func_name(settings.try_into().expect("cannot convert from Blocksense Oracle settings"))#await_postfix {
                            Ok(payload) => Ok(payload.try_into().expect("cannot convert from Blocksense Oracle payload")),
                            Err(e) => {
                                //TODO(adikov): Potentially include more types of wit Errors and
                                //implement a from trait for them. This way we can use the
                                //different Errors in the oracle components implementation.
                                Err(self::preamble::blocksense::oracle::oracle_types::Error::Other(e.to_string()))
                            },
                        }
                    })
                }
            }

            impl From<self::preamble::blocksense::oracle::oracle_types::DataFeed> for ::blocksense_sdk::oracle::DataFeedSetting {
                fn from(df: self::preamble::blocksense::oracle::oracle_types::DataFeed) -> Self {
                    Self {
                        id: df.id,
                        data: df.data,
                    }
                }
            }

            impl From<self::preamble::blocksense::oracle::oracle_types::Capability> for ::blocksense_sdk::oracle::Capability {
                fn from(capability: self::preamble::blocksense::oracle::oracle_types::Capability) -> Self {
                    Self {
                        id: capability.id,
                        data: capability.data,
                    }
                }
            }

            impl From<self::preamble::blocksense::oracle::oracle_types::Settings> for ::blocksense_sdk::oracle::Settings {
                fn from(settings: self::preamble::blocksense::oracle::oracle_types::Settings) -> Self {
                    Self {
                        data_feeds: settings.data_feeds.into_iter().map(From::from).collect(),
                        capabilities: settings.capabilities.into_iter().map(From::from).collect(),
                    }
                }
            }

            impl From<::blocksense_sdk::oracle::DataFeedResult> for self::preamble::blocksense::oracle::oracle_types::DataFeedResult {
                fn from(res: ::blocksense_sdk::oracle::DataFeedResult) -> Self {
                    Self {
                        id: res.id,
                        value: res.value.into(),
                    }
                }
            }

            impl From<::blocksense_sdk::oracle::Payload> for self::preamble::blocksense::oracle::oracle_types::Payload {
                fn from(payload: ::blocksense_sdk::oracle::Payload) -> Self {
                    Self { values: payload.values.into_iter().map(From::from).collect() }
                }
            }

            impl From<::blocksense_sdk::oracle::DataFeedResultValue> for self::preamble::blocksense::oracle::oracle_types::DataFeedResultValue {
                fn from(value: ::blocksense_sdk::oracle::DataFeedResultValue) -> Self {
                    match value {
                        ::blocksense_sdk::oracle::DataFeedResultValue::None => Self::None,
                        ::blocksense_sdk::oracle::DataFeedResultValue::Numerical(value) => Self::Numerical(value),
                        ::blocksense_sdk::oracle::DataFeedResultValue::Text(value) => Self::Text(value),
                        ::blocksense_sdk::oracle::DataFeedResultValue::Error(error) => Self::Error(error),
                    }
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
