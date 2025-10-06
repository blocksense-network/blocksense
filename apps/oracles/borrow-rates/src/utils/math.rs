use alloy::primitives::U256;

const RAY_F64: f64 = 1e27;
const WAD_F64: f64 = 1e18;
const _SECONDS_PER_YEAR: f64 = 31_536_000.0; // 365d

#[inline]
pub fn u256_low_u128(x: U256) -> u128 {
    // Mask for the low 128 bits
    let u128_mask_u256: U256 = U256::from(u128::MAX);

    // Keep only the least-significant 128 bits, then convert to u128.
    // `to::<u128>()` is provided by Alloy for exact fits.
    (x & u128_mask_u256).to::<u128>()
}

#[inline]
pub fn ray_to_apr(rate_ray: U256) -> f64 {
    // 1e27 as an exact integer
    const RAY_U128: u128 = 1_000_000_000_000_000_000_000_000_000;
    let ray_u256 = U256::from(RAY_U128);

    // Integer division to keep exactness, then convert the pieces
    let q = rate_ray / ray_u256; // integer part
    let r = rate_ray % ray_u256; // remainder (< 1e27)

    // IMPORTANT: do not truncate q to u128; convert the full U256 to f64
    let integer_part = u256_to_f64_raw(q);
    let fractional_part = (u256_low_u128(r) as f64) / (RAY_U128 as f64);

    integer_part + fractional_part
}

// internal: U256 -> f64 (no scaling, raw conversion)
fn u256_to_f64_raw<T: Into<U256>>(x: T) -> f64 {
    // Convert U256 to decimal string then parse to f64
    // f64 has ~15-17 digits precision; sufficient for most DeFi calculations
    // For higher precision requirements, consider using arbitrary precision libraries
    x.into().to_string().parse::<f64>().unwrap()
}

// APY (ray, Uint<256,4>) -> f64 fraction (e.g. 0.051234 = 5.1234%)
fn apy_ray_to_f64_fraction<T: Into<U256>>(apy_ray: T) -> f64 {
    // use to_string() to avoid limb->f64 precision loss on intermediate types
    let as_f64 = u256_to_f64_raw(apy_ray);
    as_f64 / RAY_F64
}

// WAD (1e18-scaled) -> f64 fraction
fn wad_to_f64_fraction<T: Into<U256>>(wad: T) -> f64 {
    let as_f64 = u256_to_f64_raw(wad);
    as_f64 / WAD_F64
}

/// Returns the continuously-compounded APR given APY in RAY:
/// APR_cont = ln(1 + APY)
pub fn apr_continuous<T: Into<U256>>(apy_ray: T) -> f64 {
    let apy = apy_ray_to_f64_fraction(apy_ray);
    (1.0 + apy).ln()
}

/// Converts a per-second rate in WAD (1e18) to simple, non-compounding APR.
/// APR_simple ≈ per_sec * seconds_per_year
pub fn apr_from_per_sec_wad<T: Into<U256>>(per_sec_wad: T) -> f64 {
    let per_sec = wad_to_f64_fraction(per_sec_wad);
    per_sec * _SECONDS_PER_YEAR
}

//TODO(EmilIvanichkovv): Add tests
