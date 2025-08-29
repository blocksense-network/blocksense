use anyhow::{Context, Result};
use clap::Parser;
use std::fs;
use std::path::PathBuf;
use wit_parser::Resolve;

use wit_converter::converter::Converter;

/// A WIT to Custom JSON Schema converter.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the input WIT file
    #[arg(short, long)]
    input: PathBuf,

    /// Path for the output JSON file
    #[arg(short, long)]
    output: PathBuf,
}

fn main() -> Result<()> {
    let args = Args::parse();

    // 1. Read the WIT file content
    let wit_content = fs::read_to_string(&args.input)
        .with_context(|| format!("Failed to read WIT file from {:?}", args.input))?;

    // 2. Parse the WIT file
    let mut resolve = Resolve::default();
    let pkg = resolve.push_str(&args.input, &wit_content)?;

    resolve.select_world(&[pkg], Some("blocksense-oracle"))?;

    // 3. Convert WIT resolve to our custom Schema
    let mut converter = Converter::new(&resolve);
    let schema_map = converter.convert_all()?;

    // 4. Serialize the result to JSON
    let json_output =
        serde_json::to_string_pretty(&schema_map).context("Failed to serialize schema to JSON")?;

    // 5. Write JSON to the output file
    fs::write(&args.output, json_output)
        .with_context(|| format!("Failed to write JSON output to {:?}", args.output))?;

    println!(
        "✅ Successfully converted {:?} to {:?}",
        args.input, args.output
    );

    Ok(())
}
