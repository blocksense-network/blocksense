use anyhow::Result;
use cap_std::{ambient_authority};
use std::path::Path;
use wasi_common::sync::{Dir, WasiCtxBuilder};
use wasi_common::WasiCtx;
use wasmtime::{Config, Engine, Linker, Module, Store};
use wasmtime_wasi_nn::{backend, testing, Backend, InMemoryRegistry, WasiNnCtx};

const PREOPENED_DIR_NAME: &str = "fixture";

fn main() -> Result<()> {
    run("../test-prog/nn_image_classification.rs",true)
}

fn run(path: &str, preload_model: bool) -> Result<()> {
    wasmtime_wasi_nn::check_test!();
    let path = Path::new(path);
    let config = Config::new();
    let engine = Engine::new(&config)?;
    let mut linker = Linker::new(&engine);
    wasmtime_wasi_nn::witx::add_to_linker(&mut linker, |s: &mut Ctx| &mut s.wasi_nn)?;
    wasi_common::sync::add_to_linker(&mut linker, |s: &mut Ctx| &mut s.wasi)?;
    let module = Module::from_file(&engine, path)?;
    let mut backends = vec![];
    backends.push(Backend::from(backend::openvino::OpenvinoBackend::default()));
    for backend in backends {
        let mut store = Store::new(
            &engine,
            Ctx::new(&testing::artifacts_dir(), preload_model, backend)?,
        );
        let instance = linker.instantiate(&mut store, &module)?;
        let start = instance.get_typed_func::<(), ()>(&mut store, "_start")?;
        start.call(&mut store, ())?;
    }
    Ok(())
}

struct Ctx {
    wasi: WasiCtx,
    wasi_nn: WasiNnCtx,
}
impl Ctx {
    fn new(preopen_dir: &Path, preload_model: bool, mut backend: Backend) -> Result<Self> {
        // Create the WASI context.
        let preopen_dir = Dir::open_ambient_dir(preopen_dir, ambient_authority())?;
        let mut builder = WasiCtxBuilder::new();
        builder
            .inherit_stdio()
            .preopened_dir(preopen_dir, PREOPENED_DIR_NAME)?;
        let wasi = builder.build();

        let mut registry = InMemoryRegistry::new();
        let mobilenet_dir = testing::artifacts_dir();
        if preload_model {
            registry.load((backend).as_dir_loadable().unwrap(), &mobilenet_dir)?;
        }
        let wasi_nn = WasiNnCtx::new([backend.into()], registry.into());

        Ok(Self { wasi, wasi_nn })
    }
}
