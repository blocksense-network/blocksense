use anyhow::Result;
use eth_relayer::updates_reader::print_hello;

#[tokio::main]
async fn main() -> Result<()> {
    println!("Hello");
    print_hello();
    Ok(())
}
