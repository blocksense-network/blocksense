use crate::config::{
    AlpacaRequest, AlpacaResponse, EmbeddingRequest, EmbeddingResponse, VerificationRequest,
    VerificationResponse,
};
use url::Url;

#[derive(Debug)]
pub struct AlpacaCore;

impl AlpacaCore {
    pub async fn send_alpaca_request(
        url: Url,
        request: AlpacaRequest,
    ) -> anyhow::Result<AlpacaResponse> {
        let alpaca_url = url.join("/chat/completions")?;
        let client = reqwest::Client::new();
        let resp = client
            .post(alpaca_url.clone())
            .json(&request)
            .send()
            .await?;
        let alpaca: AlpacaResponse = resp.json::<AlpacaResponse>().await?;
        Ok(alpaca)
    }

    pub async fn send_embedding_request(
        url: Url,
        request: EmbeddingRequest,
    ) -> anyhow::Result<EmbeddingResponse> {
        let embedding_url = url.join("/embeddings")?;
        let client = reqwest::Client::new();
        let resp = client
            .post(embedding_url.clone())
            .json(&request)
            .send()
            .await?;
        let embedding: EmbeddingResponse = resp.json::<EmbeddingResponse>().await?;
        Ok(embedding)
    }

    pub async fn send_verification_request(
        url: Url,
        request: VerificationRequest,
    ) -> anyhow::Result<VerificationResponse> {
        let verification_url = url.join("/verify")?;
        let client = reqwest::Client::new();
        let resp = client
            .post(verification_url.clone())
            .json(&request)
            .send()
            .await?;
        let verification: VerificationResponse = resp.json::<VerificationResponse>().await?;
        Ok(verification)
    }
}
