use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::SystemTime;

// Chat complete - /chat/completions

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Message {
    /// Message's owner role
    pub role: String,
    /// Message's textual content
    pub content: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AlpacaRequest {
    /// Id of the model to use.
    pub model: String,

    /// A list of the conversation messages.
    pub messages: Vec<Message>,

    /// The maximum number of tokens that can be generated if invalid token is not generated.
    pub max_completion_tokens: u64,

    /// The seed provided to the sampler. If not provided will select random seed.
    pub seed: Option<u64>,

    /// What sampling temperature to use
    pub temperature: f64,

    /// An alternative to sampling with temperature. The model will the tokens which have top_p probability mass.
    pub top_p: Option<f64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct TokenData {
    /// tokenId
    pub token: String,

    /// Vector with tokenId and it's logit value
    pub logits: HashMap<String, String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub enum FinishReason {
    /// If natural stop point was hit
    Stop,
    /// If the max tokens count from request was hit
    Length,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Output {
    /// The content of the completion
    content: String,

    /// The role of content's owner
    role: String,

    finish_reason: FinishReason,

    /// List of all generated tokens and their corresponding top 10 logits at the time.
    tokens_data: TokenData,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AlpacaResponse {
    /// Id of the model to use.
    pub model: String,

    /// The Unix timestamp of completion's creation
    pub created: SystemTime,

    /// Full chat after applying chat format
    pub formatted_chat: String,

    /// The completion's response
    pub output: Output,

    /// The seed provided to the sampler. If not provided will select random seed.
    pub seed: u64,

    /// The object type, always "chat.completion"
    pub object: String,
}

// Embeddings - /embeddings

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EmbeddingRequest {
    /// Id of the model to use.
    pub model: String,

    /// The input text to embed.
    pub input: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EmbeddingResponse {
    /// The embedding vector which is a list of floats. Length depends on the model
    pub embedding: Vec<f64>,
}

// Verification - /verify

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Logit {
    pub token: String,
    pub logit: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationRequest {
    /// Id of the model to use.
    pub model: String,

    /// The inital prompt that was generated for
    pub prompt: String,

    /// The input text to embed.
    pub tokens_data: Vec<TokenData>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VerificationResponse {
    /// A floating point value between 0-1 that determines how close it is to the input tokens_data
    pub similarity: Option<f64>,

    /// The input text to embed.
    pub tokens_data: Option<Vec<TokenData>>,
}
