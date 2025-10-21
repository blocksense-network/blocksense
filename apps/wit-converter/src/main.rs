use anyhow::{bail, Context, Result};
use clap::Parser;
use std::fs;
use std::path::PathBuf;
use wit_parser::{FunctionKind, Resolve, Type, TypeDefKind, WorldItem};

use wit_converter::converter::Converter;

/// A WIT to Custom JSON Schema converter.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the input WIT file
    #[arg(short, long)]
    input: PathBuf,

    /// Path for the output JSON file (or stdout)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// WIT world to extract from
    #[arg(short, long, default_value = "blocksense-oracle")]
    world: String,

    /// Function name to extract the payload type from
    #[arg(short, long, default_value = "handle-oracle-request")]
    function: String,
}

fn main() -> Result<()> {
    let args = Args::parse();
    // Parse the WIT file
    let mut resolve = Resolve::default();
    let pkg = resolve.push_file(&args.input)?;

    let world_id = resolve.select_world(&[pkg], Some(&args.world))?;

    let world = resolve
        .worlds
        .get(world_id)
        .with_context(|| format!("World {:?} not found", args.world))?;

    let function = world
        .exports
        .iter()
        .find_map(|(_, wi)| match wi {
            WorldItem::Function(function) if function.name == args.function => Some(function),
            _ => None,
        })
        .with_context(|| {
            format!(
                "Function {:?} not found in the specified world {:?}",
                args.function, args.world
            )
        })?;

    assert_eq!(
        function.kind,
        FunctionKind::Freestanding,
        "Function has to be freestanding (no async, no method, etc.)"
    );

    let payload_type_name = match function.result {
        Some(Type::Id(result_id)) => {
            let result_type_def = resolve
                .types
                .get(result_id)
                .context("Could not find type")?;
            match &result_type_def.kind {
                TypeDefKind::Result(result) => match result.ok {
                    Some(Type::Id(payload_id)) => {
                        let payload_type_def = resolve
                            .types
                            .get(payload_id)
                            .context("Could not find type")?;
                        payload_type_def
                            .name
                            .clone()
                            .context("Payload type has to be named")?
                    }
                    _ => bail!("Result has to have a `ok` type"),
                },
                _ => bail!("Specified function has to return a `result`"),
            }
        }
        Some(_) => bail!("Specified function's return type needs to refer to a user type"),
        None => bail!("Specified function needs to have a return type"),
    };

    // Convert WIT resolve to our custom Schema
    let mut converter = Converter::new(&resolve);
    let schema_map = converter.convert_all()?;

    // Serialize the result to JSON
    let json_output = serde_json::to_string_pretty(&serde_json::json!({
        "payloadTypeName": Converter::convert_name(&payload_type_name, true),
        "types": schema_map,
    }))
    .context("Failed to serialize schema to JSON")?;

    // Write JSON to the output file
    fs::write(
        args.output
            .as_ref()
            // Cleaner defaulting to `stdout`
            .unwrap_or(&PathBuf::from("/dev/stdout")),
        json_output,
    )
    .with_context(|| format!("Failed to write JSON output to {:?}", args.output))?;

    eprintln!(
        "✅ Successfully converted {:?} to {:?}",
        args.input, args.output
    );

    Ok(())
}
