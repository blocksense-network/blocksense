global ZERO: Field = 0;
global ONE: Field = 1;
global TWO: Field = 2;
global THREE: Field = 3;
global FOUR: Field = 4;
global FIFTY_NINE: Field = 59;
global TWO_POW_13: Field = 8192; // 2^13
global TWO_POW_115: Field = 41538374868278621028243970633760768; // 2^115
global TWO_POW_128: Field = 340282366920938463463374607431768211456; // 2^128

unconstrained pub fn calculate_feed_index(feed_id: Field, round: Field, stride: Field) -> Field {
    (TWO_POW_128 * TWO.pow_32(stride)) + ((feed_id * TWO_POW_13) * TWO.pow_32(stride)) + (round * TWO.pow_32(stride))
}

unconstrained fn calculate_round_index(stride: Field, feed_id: Field) -> Field {
    ((TWO_POW_115 * stride) + feed_id)
}

/// stride 0 = 0
global zero_round_index: Field = calculate_round_index(ZERO, ZERO);
global one_round_index: Field = calculate_round_index(ZERO, 15);
global two_round_index: Field = calculate_round_index(ZERO, 30);
global three_round_index: Field = calculate_round_index(ZERO, 45);
global zero_feed_index: Field = calculate_feed_index(ZERO, zero_round_index, ZERO);
global fifteen_feed_index: Field = calculate_feed_index(15, one_round_index, ZERO);
global thirty_feed_index: Field = calculate_feed_index(30, two_round_index, ZERO);
global fortyfive_feed_index: Field = calculate_feed_index(45, three_round_index, ZERO);

global _59_DATA_FEEDS_STRIDE_0: [Field; 185] = [
    // Feeds
    calculate_feed_index(0, zero_round_index, ZERO), ONE, 48147686,
    calculate_feed_index(1, zero_round_index, ZERO), ONE, 65136033,
    calculate_feed_index(2, zero_round_index, ZERO), ONE, 56191306,
    calculate_feed_index(3, zero_round_index, ZERO), ONE, 4975109,
    calculate_feed_index(4, zero_round_index, ZERO), ONE, 69789472,
    calculate_feed_index(5, zero_round_index, ZERO), ONE, 54419364,
    calculate_feed_index(6, zero_round_index, ZERO), ONE, 59663345,
    calculate_feed_index(7, zero_round_index, ZERO), ONE, 10093128,
    calculate_feed_index(8, zero_round_index, ZERO), ONE, 18643828,
    calculate_feed_index(9, zero_round_index, ZERO), ONE, 80127931,
    calculate_feed_index(10, zero_round_index, ZERO), ONE, 116802998,
    calculate_feed_index(11, zero_round_index, ZERO), ONE, 98735792,
    calculate_feed_index(12, zero_round_index, ZERO), ONE, 32196377,
    calculate_feed_index(13, zero_round_index, ZERO), ONE, 78462028,
    calculate_feed_index(14, zero_round_index, ZERO), ONE, 114230232,
    calculate_feed_index(15, one_round_index, ZERO), ONE, 84328912, //
    calculate_feed_index(16, one_round_index, ZERO), ONE, 67561109,
    calculate_feed_index(17, one_round_index, ZERO), ONE, 67751087,
    calculate_feed_index(18, one_round_index, ZERO), ONE, 57746767,
    calculate_feed_index(19, one_round_index, ZERO), ONE, 119362830,
    calculate_feed_index(20, one_round_index, ZERO), ONE, 86309775,
    calculate_feed_index(21, one_round_index, ZERO), ONE, 17569215,
    calculate_feed_index(22, one_round_index, ZERO), ONE, 58535978,
    calculate_feed_index(23, one_round_index, ZERO), ONE, 87113748,
    calculate_feed_index(24, one_round_index, ZERO), ONE, 8101050,
    calculate_feed_index(25, one_round_index, ZERO), ONE, 36247949,
    calculate_feed_index(26, one_round_index, ZERO), ONE, 30947384,
    calculate_feed_index(27, one_round_index, ZERO), ONE, 58646776,
    calculate_feed_index(28, one_round_index, ZERO), ONE, 116117791,
    calculate_feed_index(29, one_round_index, ZERO), ONE, 17593144,
    calculate_feed_index(30, two_round_index, ZERO), ONE, 55120591, //
    calculate_feed_index(31, two_round_index, ZERO), ONE, 41102345,
    calculate_feed_index(32, two_round_index, ZERO), ONE, 94246385,
    calculate_feed_index(33, two_round_index, ZERO), ONE, 32169692,
    calculate_feed_index(34, two_round_index, ZERO), ONE, 37547068,
    calculate_feed_index(35, two_round_index, ZERO), ONE, 24265380,
    calculate_feed_index(36, two_round_index, ZERO), ONE, 88488010,
    calculate_feed_index(37, two_round_index, ZERO), ONE, 80492876,
    calculate_feed_index(38, two_round_index, ZERO), ONE, 66286539,
    calculate_feed_index(39, two_round_index, ZERO), ONE, 31151294,
    calculate_feed_index(40, two_round_index, ZERO), ONE, 72776795,
    calculate_feed_index(41, two_round_index, ZERO), ONE, 105613956,
    calculate_feed_index(42, two_round_index, ZERO), ONE, 47118151,
    calculate_feed_index(43, two_round_index, ZERO), ONE, 33622121,
    calculate_feed_index(44, two_round_index, ZERO), ONE, 8230705,
    calculate_feed_index(45, three_round_index, ZERO), ONE, 83296120, //
    calculate_feed_index(46, three_round_index, ZERO), ONE, 80975073,
    calculate_feed_index(47, three_round_index, ZERO), ONE, 33292601,
    calculate_feed_index(48, three_round_index, ZERO), ONE, 48394176,
    calculate_feed_index(49, three_round_index, ZERO), ONE, 87367070,
    calculate_feed_index(50, three_round_index, ZERO), ONE, 19255074,
    calculate_feed_index(51, three_round_index, ZERO), ONE, 99552203,
    calculate_feed_index(52, three_round_index, ZERO), ONE, 122363829,
    calculate_feed_index(53, three_round_index, ZERO), ONE, 54669258,
    calculate_feed_index(54, three_round_index, ZERO), ONE, 74973219,
    calculate_feed_index(55, three_round_index, ZERO), ONE, 119340840,
    calculate_feed_index(56, three_round_index, ZERO), ONE, 24073850,
    calculate_feed_index(57, three_round_index, ZERO), ONE, 103273774,
    calculate_feed_index(58, three_round_index, ZERO), ONE, 72975937,
    // Rounds
    zero_round_index, ZERO,
    one_round_index, ONE,
    two_round_index, TWO,
    three_round_index, THREE,
];
