use alloy::primitives::U256;

const RAY_F64: f64 = 1e27;

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
