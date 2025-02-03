global ZERO: Field = 0;
global ONE: Field = 1;
global TWO: Field = 2;
global THREE: Field = 3;
global TWO_POW_13: Field = 8192; // 2^13
global TWO_POW_115: Field = 41538374868278621028243970633760768; // 2^115
global TWO_POW_128: Field = 340282366920938463463374607431768211456; // 2^128

unconstrained fn calculate_feed_index(feed_id: Field, round: Field, stride: Field) -> Field {
    (TWO_POW_128 * TWO.pow_32(stride)) + ((feed_id * TWO_POW_13) * TWO.pow_32(stride)) + (round * TWO.pow_32(stride))
}

unconstrained fn calculate_round_index(stride: Field, feed_id: Field) -> Field {
    let latest_rounds_record = ((TWO_POW_115 * stride + feed_id) / 15);
    let quotient = latest_rounds_record / 15;
    let quot_times_15 = quotient * 15;
    latest_rounds_record - quot_times_15
}

/// stride 0 = 0
global zero_feed_index: Field = calculate_feed_index(ZERO, ZERO, ZERO);
global fifteen_feed_index: Field = calculate_feed_index(15, ONE, ZERO);
global thirty_feed_index: Field = calculate_feed_index(30, TWO, ZERO);
global fortyfive_feed_index: Field = calculate_feed_index(45, THREE, ZERO);
global zero_round_index: Field = calculate_round_index(ZERO, zero_feed_index);
global one_round_index: Field = calculate_round_index(ZERO, fifteen_feed_index);
global two_round_index: Field = calculate_round_index(ZERO, thirty_feed_index);
global three_round_index: Field = calculate_round_index(ZERO, fortyfive_feed_index);

global _59_DATA_FEEDS_STRIDE_0: [Field; 185] = [
    // Feeds
    zero_feed_index, ONE, 48147686,
    zero_feed_index + 1, ONE, 65136033,
    zero_feed_index + 2, ONE, 56191306,
    zero_feed_index + 3, ONE, 4975109,
    zero_feed_index + 4, ONE, 69789472,
    zero_feed_index + 5, ONE, 54419364,
    zero_feed_index + 6, ONE, 59663345,
    zero_feed_index + 7, ONE, 10093128,
    zero_feed_index + 8, ONE, 18643828,
    zero_feed_index + 9, ONE, 80127931,
    zero_feed_index + 10, ONE, 116802998,
    zero_feed_index + 11, ONE, 98735792,
    zero_feed_index + 12, ONE, 32196377,
    zero_feed_index + 13, ONE, 78462028,
    zero_feed_index + 14, ONE, 114230232,
    fifteen_feed_index, ONE, 84328912,
    fifteen_feed_index + 1, ONE, 67561109,
    fifteen_feed_index + 2, ONE, 67751087,
    fifteen_feed_index + 3, ONE, 57746767,
    fifteen_feed_index + 4, ONE, 119362830,
    fifteen_feed_index + 5, ONE, 86309775,
    fifteen_feed_index + 6, ONE, 17569215,
    fifteen_feed_index + 7, ONE, 58535978,
    fifteen_feed_index + 8, ONE, 87113748,
    fifteen_feed_index + 9, ONE, 8101050,
    fifteen_feed_index + 10, ONE, 36247949,
    fifteen_feed_index + 11, ONE, 30947384,
    fifteen_feed_index + 12, ONE, 58646776,
    fifteen_feed_index + 13, ONE, 116117791,
    fifteen_feed_index + 14, ONE, 17593144,
    thirty_feed_index, ONE, 55120591,
    thirty_feed_index + 1, ONE, 41102345,
    thirty_feed_index + 2, ONE, 94246385,
    thirty_feed_index + 3, ONE, 32169692,
    thirty_feed_index + 4, ONE, 37547068,
    thirty_feed_index + 5, ONE, 24265380,
    thirty_feed_index + 6, ONE, 88488010,
    thirty_feed_index + 7, ONE, 80492876,
    thirty_feed_index + 8, ONE, 66286539,
    thirty_feed_index + 9, ONE, 31151294,
    thirty_feed_index + 10, ONE, 72776795,
    thirty_feed_index + 11, ONE, 105613956,
    thirty_feed_index + 12, ONE, 47118151,
    thirty_feed_index + 13, ONE, 33622121,
    thirty_feed_index + 14, ONE, 8230705,
    fortyfive_feed_index, ONE, 83296120,
    fortyfive_feed_index + 1, ONE, 80975073,
    fortyfive_feed_index + 2, ONE, 33292601,
    fortyfive_feed_index + 3, ONE, 48394176,
    fortyfive_feed_index + 4, ONE, 87367070,
    fortyfive_feed_index + 5, ONE, 19255074,
    fortyfive_feed_index + 6, ONE, 99552203,
    fortyfive_feed_index + 7, ONE, 122363829,
    fortyfive_feed_index + 8, ONE, 54669258,
    fortyfive_feed_index + 9, ONE, 74973219,
    fortyfive_feed_index + 10, ONE, 119340840,
    fortyfive_feed_index + 11, ONE, 24073850,
    fortyfive_feed_index + 12, ONE, 103273774,
    fortyfive_feed_index + 13, ONE, 72975937,
    // Round
    ZERO, zero_round_index,
    ONE, one_round_index,
    TWO, two_round_index,
    THREE, three_round_index,
];
