use anyhow::{bail, Context, Result};
use clap::Parser;
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
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

    /// Load only the dependencies (the sibling `deps/` tree) of the given
    /// WIT package, without loading that package itself. Useful to reuse
    /// vendored deps like `libs/sdk/wit/blocksense-oracle.wit` while keeping
    /// your own input as the main package.
    #[arg(long, value_name = "PATH")]
    deps_of: Option<PathBuf>,
}

fn main() -> Result<()> {
    let args = Args::parse();
    // Parse the WIT file
    let mut resolve = Resolve::default();

    // Optionally include deps from an anchor package's `deps/` dir (but not the anchor itself).
    if let Some(anchor) = args.deps_of.as_deref() {
        // Resolve the deps/ directory from a file or directory anchor.
        let deps_dir = if anchor.is_file() {
            anchor.parent().unwrap_or(Path::new("."))
        } else {
            anchor
        }
        .join("deps");
        if deps_dir.is_dir() {
            // Parse all dependency packages as groups so we can topo-sort them
            // like Resolve::push_dir would, without adding the anchor package.
            let mut groups = Vec::new();
            for entry in fs::read_dir(&deps_dir)
                .with_context(|| format!("Failed to read deps dir: {}", deps_dir.display()))?
            {
                let dep = entry?;
                let path = dep.path();
                if dep.file_type()?.is_dir() {
                    let group = wit_parser::UnresolvedPackageGroup::parse_dir(&path).with_context(
                        || format!("Failed to parse WIT package: {}", path.display()),
                    )?;
                    groups.push(group);
                } else if path.extension().and_then(|s| s.to_str()) == Some("wit") {
                    let contents = fs::read_to_string(&path)
                        .with_context(|| format!("Failed to read WIT file {}", path.display()))?;
                    let group = wit_parser::UnresolvedPackageGroup::parse(&path, &contents)
                        .with_context(|| format!("Failed to parse WIT file {}", path.display()))?;
                    groups.push(group);
                }
            }

            // Build name->index map for topo sort
            let mut name_to_idx: HashMap<wit_parser::PackageName, usize> = HashMap::new();
            for (i, g) in groups.iter().enumerate() {
                name_to_idx.insert(g.main.name.clone(), i);
            }

            // Kahn's topo order on groups by foreign_deps
            let mut edges: Vec<Vec<usize>> = vec![Vec::new(); groups.len()];
            let mut indeg: Vec<usize> = vec![0; groups.len()];
            for (i, g) in groups.iter().enumerate() {
                for dep_name in g.main.foreign_deps.keys() {
                    if let Some(&j) = name_to_idx.get(dep_name) {
                        edges[j].push(i);
                        indeg[i] += 1;
                    }
                }
            }
            let mut q = VecDeque::new();
            for (i, &item) in indeg.iter().enumerate().take(groups.len()) {
                if item == 0 {
                    q.push_back(i);
                }
            }
            let mut order = Vec::with_capacity(groups.len());
            while let Some(i) = q.pop_front() {
                order.push(i);
                for &n in &edges[i] {
                    indeg[n] -= 1;
                    if indeg[n] == 0 {
                        q.push_back(n);
                    }
                }
            }
            if order.len() != groups.len() {
                // Fallback to insertion order if a cycle is detected.
                order = (0..groups.len()).collect();
            }

            for i in order {
                let g = groups[i].clone();
                if resolve.package_names.contains_key(&g.main.name) {
                    continue;
                }
                resolve
                    .push_group(g)
                    .with_context(|| "Failed to insert dependency package")?;
            }
        }
    }

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
