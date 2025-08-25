use alloy::primitives::U256;

const RAY_F64: f64 = 1e27;
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
    let ray_u256: U256 = U256::from(1_000_000_000_000_000_000_000_000_000u128); // 1e27
                                                                                // Do integer division first to preserve precision.
    let q = rate_ray / ray_u256; // integer part (APR >= 1.0 if q >= 1)
    let r = rate_ray % ray_u256; // remainder < 1e27

    let integer_part = u256_low_u128(q) as f64;
    let fractional_part = (u256_low_u128(r) as f64) / RAY_F64;

    integer_part + fractional_part
}

// internal: Uint<256,4> -> f64 (no scaling)
fn apy_ray_to_f64_raw<T: Into<U256>>(x: T) -> f64 {
    // U256::to_string() => decimal string -> f64
    // f64 has ~15-17 digits precision; for APY magnitudes seen in DeFi this is fine.
    // If you need more precision, use num-bigfloat/rug (shown below).
    x.into().to_string().parse::<f64>().unwrap()
}

// APY (ray, Uint<256,4>) -> f64 fraction (e.g. 0.051234 = 5.1234%)
fn apy_ray_to_f64_fraction<T: Into<U256>>(apy_ray: T) -> f64 {
    // use to_string() to avoid limb->f64 precision loss on intermediate types
    let as_f64 = apy_ray_to_f64_raw(apy_ray);
    as_f64 / RAY_F64
}
// APR whose per-second compounding gives the APY
pub fn _apr_nominal_per_second<T: Into<U256>>(apy_ray: T) -> f64 {
    let apy = apy_ray_to_f64_fraction(apy_ray); // effective APY as fraction
    _SECONDS_PER_YEAR * ((1.0 + apy).powf(1.0 / _SECONDS_PER_YEAR) - 1.0)
}

// Continuous-comp equivalent (“simple APR”)
pub fn apr_continuous<T: Into<U256>>(apy_ray: T) -> f64 {
    let apy = apy_ray_to_f64_fraction(apy_ray);
    (1.0 + apy).ln()
}
