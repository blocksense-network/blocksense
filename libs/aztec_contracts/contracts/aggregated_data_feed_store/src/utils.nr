use bignum::fields::U256::U256Params;
use bignum::BigNum;

global MAX_FEED_INPUT_BYTES: u32 = 1013638;
global U16_MAX_VALUE: u16 = 65535;
global LEN_31: u32 = 31;


/// This function is going to be invoked by noir_rs intermediary function in the Sequencer
//          u254                    u16                 Vec<u8>
// (id Feed round stride)  | the feed's length |  | the feed's data
// pub fn gather_bytes_and_ids(feed_input_data: [u8; MAX_FEED_INPUT_BYTES], feeds_len: u32) {
//     for i in 0..feeds_len {
//         for j in 0..feed_input_data {

//         }
//     }
// }

pub fn serialize_data_bytes_to_fields(
        feed_input_data: [u8; U16_MAX_VALUE],
        feed_len: u16
    ) -> pub [Field; MAX_FEED_INPUT_BYTES / 31] {
    // Vector with the data feed bytes without the singleton values
    let mut data_feed_bytes: Vec<u8> = Vec::new();
    for i in 0..feed_len {
        data_feed_bytes.push(feed_input_data[i]);
    }

    // TODO: Measure opcodes for `serialized_data_feed_bytes` being an array instead of `BoundedVec`
    let mut serialized_data_feed_bytes: BoundedVec<Field, MAX_DATA_FEED_LEN_AS_FIELDS> = BoundedVec::new();
    let len_of_feed_as_fields = data_feed_bytes.len() / LEN_31;
    for i in 0..len_of_feed_as_fields {
        let mut current_serialized_data_feed_bytes = [0 as u8; LEN_31];
        let mut helper_index = 0;
        for j in i * LEN_31..(i + 1) * LEN_31 {
            current_serialized_data_feed_bytes[helper_index] = data_feed_bytes.get(j);
            helper_index += 1;
        }
        serialized_data_feed_bytes.push(bytes31_to_field(current_serialized_data_feed_bytes));
    }

    // Add remaining bytes to the serialized data feed in fields
    let mut remaining_bytes: BoundedVec<u8, LEN_31 - 1> = BoundedVec::new();
    for i in (len_of_feed_as_fields * LEN_31)..feed_len - (len_of_feed_as_fields * LEN_31) {
        remaining_bytes.push(data_feed_bytes.get(i));
    }
    serialized_data_feed_bytes.push(Field::from_be_bytes::<LEN_31 - 1>(remaining_bytes.storage));

    serialized_data_feed_bytes.storage
}

/// Converts 31 bytes to Field element
pub fn bytes31_to_field(bytes31: [u8; 31]) -> pub Field {
    let mut res_field: Field = 0;
    let mut mul: Field = 1;

    for i in 1..32 {
        let curr_byte: Field = bytes31[31 - i] as Field;
        res_field = res_field + (curr_byte * mul);
        mul *= 256;
    }

    res_field
}

/// TODO: Casts U256 to Field
