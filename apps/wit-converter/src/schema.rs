use serde::Serialize;

// Represents `PrimitiveField`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrimitiveField {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// Size in bits
    pub size: Option<u32>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompositeField {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub components: Vec<ComponentFieldEnum>,
}

// Represents the union type `PrimitiveField | CompositeField`
#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum ComponentFieldEnum {
    Primitive(PrimitiveField),
    Composite(CompositeField),
}

// Represents `ExpandedField`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpandedField {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub size: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shift: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iterations: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_dynamic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<Vec<ExpandedFieldOrArray>>,
}

// Represents the recursive type `ExpandedField | ExpandedFieldOrArray[]`
#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum ExpandedFieldOrArray {
    Field(Box<ExpandedField>),
    Array(Vec<ExpandedFieldOrArray>),
}

// Represents `GenerateDecoderConfig`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDecoderConfig {
    pub word_offset: u32,
    pub prev_size: u32,
    pub bit_offset: u32,
}

// Represents `DecoderData`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DecoderData {
    pub config: GenerateDecoderConfig,
    pub field: ExpandedField,
    pub location: String,
    pub index: u32,
}

// Represents `Struct`
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Struct {
    pub name: String,
    pub fields: Vec<PrimitiveField>,
}
