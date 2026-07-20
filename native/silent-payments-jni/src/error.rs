use crate::codec::{CODEC_VERSION, RESULT_MAGIC};

/// Stable non-secret error codes shared by Rust JNI and Kotlin.
#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeErrorCode {
    InvalidSecret = 1,
    InvalidNetwork = 2,
    InvalidPublicBatch = 3,
    ResourceLimit = 4,
    InvalidPublicRecord = 5,
    EccFailure = 6,
    Internal = 7,
}

impl NativeErrorCode {
    pub const fn from_byte(value: u8) -> Option<Self> {
        Some(match value {
            1 => Self::InvalidSecret,
            2 => Self::InvalidNetwork,
            3 => Self::InvalidPublicBatch,
            4 => Self::ResourceLimit,
            5 => Self::InvalidPublicRecord,
            6 => Self::EccFailure,
            7 => Self::Internal,
            _ => return None,
        })
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidSecret => "INVALID_SECRET",
            Self::InvalidNetwork => "INVALID_NETWORK",
            Self::InvalidPublicBatch => "INVALID_PUBLIC_BATCH",
            Self::ResourceLimit => "RESOURCE_LIMIT",
            Self::InvalidPublicRecord => "INVALID_PUBLIC_RECORD",
            Self::EccFailure => "ECC_FAILURE",
            Self::Internal => "INTERNAL",
        }
    }
}

/// Encode a failure without including source errors, secrets, public records, or timing detail.
pub(crate) fn encode_error_result(code: NativeErrorCode) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(6);
    bytes.extend_from_slice(&RESULT_MAGIC);
    bytes.push(CODEC_VERSION);
    bytes.push(code as u8);
    bytes
}
