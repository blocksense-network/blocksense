pub global ZERO: Field = 0;
pub global ONE: Field = 1;
pub global TWO: Field = 2;
pub global THREE: Field = 3;
pub global MAX_ROUNDS_SIZE_FOR_STRIDE_0: u32 = 4;
pub global MAX_ROUND_VALUES_IN_A_FIELD: Field = 15;
pub global ROUND_SIZE_IN_BITS: Field = 16;
pub global MAX_FEEDS_SIZE_FOR_STRIDE_0: u32 = 58;
pub global TWO_POW_13: Field = 8192; // 2^13
pub global TWO_POW_16: Field = 65536; // 2^16
pub global TWO_POW_115: Field = 41538374868278621028243970633760768; // 2^115
pub global TWO_POW_128: Field = 340282366920938463463374607431768211456; // 2^128

pub unconstrained fn calculate_feed_index(feed_id: Field, round: Field, stride: Field) -> Field {
    (TWO_POW_128 * TWO.pow_32(stride))
        + ((feed_id * TWO_POW_13) * TWO.pow_32(stride))
        + (round * TWO.pow_32(stride))
}

pub fn calculate_round_index(stride: Field, feed_id: Field) -> Field {
    ((TWO_POW_115 * stride) + feed_id) / MAX_ROUND_VALUES_IN_A_FIELD
}

pub fn calculate_slot_position(feed_id: Field) -> Field {
    let quotient = feed_id / MAX_ROUND_VALUES_IN_A_FIELD;
    let remainder = feed_id - (quotient * MAX_ROUND_VALUES_IN_A_FIELD);

    remainder
}

pub fn get_slot_value(row_value: Field, slot_index: Field) -> Field {
    let shift_factor = TWO.pow_32(slot_index * ROUND_SIZE_IN_BITS);
    let shifted_value = row_value / shift_factor;

    let upper_bits = (shifted_value / TWO_POW_16) * TWO_POW_16;
    let slot_value = shifted_value - upper_bits;

    slot_value
}

/// stride 0 = 0
pub global zero_round_index: Field = calculate_round_index(ZERO, ZERO);
pub global one_round_index: Field = calculate_round_index(ZERO, 15);
pub global two_round_index: Field = calculate_round_index(ZERO, 30);
pub global three_round_index: Field = calculate_round_index(ZERO, 45);

pub global _58_DATA_FEEDS_STRIDE_0: [Field; 182] = [
    // Feeds
    calculate_feed_index(0, 0, ZERO),
    ONE,
    48147686,
    calculate_feed_index(1, 1, ZERO),
    ONE,
    65136033,
    calculate_feed_index(2, 2, ZERO),
    ONE,
    56191306,
    calculate_feed_index(3, 3, ZERO),
    ONE,
    4975109,
    calculate_feed_index(4, 4, ZERO),
    ONE,
    69789472,
    calculate_feed_index(5, 5, ZERO),
    ONE,
    54419364,
    calculate_feed_index(6, 6, ZERO),
    ONE,
    59663345,
    calculate_feed_index(7, 7, ZERO),
    ONE,
    10093128,
    calculate_feed_index(8, 8, ZERO),
    ONE,
    18643828,
    calculate_feed_index(9, 9, ZERO),
    ONE,
    80127931,
    calculate_feed_index(10, 10, ZERO),
    ONE,
    116802998,
    calculate_feed_index(11, 11, ZERO),
    ONE,
    98735792,
    calculate_feed_index(12, 12, ZERO),
    ONE,
    32196377,
    calculate_feed_index(13, 13, ZERO),
    ONE,
    78462028,
    calculate_feed_index(14, 14, ZERO),
    ONE,
    114230232,
    calculate_feed_index(15, 15, ZERO),
    ONE,
    84328912, //
    calculate_feed_index(16, 16, ZERO),
    ONE,
    67561109,
    calculate_feed_index(17, 17, ZERO),
    ONE,
    67751087,
    calculate_feed_index(18, 18, ZERO),
    ONE,
    57746767,
    calculate_feed_index(19, 19, ZERO),
    ONE,
    119362830,
    calculate_feed_index(20, 20, ZERO),
    ONE,
    86309775,
    calculate_feed_index(21, 21, ZERO),
    ONE,
    17569215,
    calculate_feed_index(22, 22, ZERO),
    ONE,
    58535978,
    calculate_feed_index(23, 23, ZERO),
    ONE,
    87113748,
    calculate_feed_index(24, 24, ZERO),
    ONE,
    8101050,
    calculate_feed_index(25, 25, ZERO),
    ONE,
    36247949,
    calculate_feed_index(26, 26, ZERO),
    ONE,
    30947384,
    calculate_feed_index(27, 27, ZERO),
    ONE,
    58646776,
    calculate_feed_index(28, 28, ZERO),
    ONE,
    116117791,
    calculate_feed_index(29, 29, ZERO),
    ONE,
    17593144,
    calculate_feed_index(30, 30, ZERO),
    ONE,
    55120591, //
    calculate_feed_index(31, 31, ZERO),
    ONE,
    41102345,
    calculate_feed_index(32, 32, ZERO),
    ONE,
    94246385,
    calculate_feed_index(33, 33, ZERO),
    ONE,
    32169692,
    calculate_feed_index(34, 34, ZERO),
    ONE,
    37547068,
    calculate_feed_index(35, 35, ZERO),
    ONE,
    24265380,
    calculate_feed_index(36, 36, ZERO),
    ONE,
    88488010,
    calculate_feed_index(37, 37, ZERO),
    ONE,
    80492876,
    calculate_feed_index(38, 38, ZERO),
    ONE,
    66286539,
    calculate_feed_index(39, 39, ZERO),
    ONE,
    31151294,
    calculate_feed_index(40, 40, ZERO),
    ONE,
    72776795,
    calculate_feed_index(41, 41, ZERO),
    ONE,
    105613956,
    calculate_feed_index(42, 42, ZERO),
    ONE,
    47118151,
    calculate_feed_index(43, 43, ZERO),
    ONE,
    33622121,
    calculate_feed_index(44, 44, ZERO),
    ONE,
    8230705,
    calculate_feed_index(45, 45, ZERO),
    ONE,
    83296120, //
    calculate_feed_index(46, 46, ZERO),
    ONE,
    80975073,
    calculate_feed_index(47, 47, ZERO),
    ONE,
    33292601,
    calculate_feed_index(48, 48, ZERO),
    ONE,
    48394176,
    calculate_feed_index(49, 49, ZERO),
    ONE,
    87367070,
    calculate_feed_index(50, 50, ZERO),
    ONE,
    19255074,
    calculate_feed_index(51, 51, ZERO),
    ONE,
    99552203,
    calculate_feed_index(52, 52, ZERO),
    ONE,
    122363829,
    calculate_feed_index(53, 53, ZERO),
    ONE,
    54669258,
    calculate_feed_index(54, 54, ZERO),
    ONE,
    74973219,
    calculate_feed_index(55, 55, ZERO),
    ONE,
    119340840,
    calculate_feed_index(56, 56, ZERO),
    ONE,
    24073850,
    calculate_feed_index(57, 57, ZERO),
    ONE,
    103273774,
    // Rounds
    zero_round_index,
    ZERO,
    one_round_index,
    ONE,
    two_round_index,
    TWO,
    three_round_index,
    THREE,
];
