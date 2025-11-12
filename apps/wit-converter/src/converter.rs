use crate::schema::{ComponentFieldEnum, CompositeField, PrimitiveField};
use anyhow::{bail, Result};
use std::collections::HashMap;
use wit_parser::{FlagsRepr, Handle, Resolve, Result_, Type, TypeDefKind, TypeId};

/// A context for the conversion process.
pub struct Converter<'a> {
    resolve: &'a Resolve,
    /// Memoization cache to avoid re-processing the same TypeId.
    memo: HashMap<TypeId, ComponentFieldEnum>,
}

impl<'a> Converter<'a> {
    /// Creates a new Converter.
    pub fn new(resolve: &'a Resolve) -> Self {
        Self {
            resolve,
            memo: HashMap::new(),
        }
    }

    /// Public entry point to convert all WIT records into TupleField representations.
    /// The result is a map where the key is the struct name.
    pub fn convert_all(&mut self) -> Result<HashMap<String, CompositeField>> {
        let mut top_level_structs = HashMap::new();

        let record_and_union_ids: Vec<(TypeId, String)> = self
            .resolve
            .types
            .iter()
            .filter_map(|(id, ty_def)| {
                if let (Some(name), TypeDefKind::Record(_) | TypeDefKind::Variant(_)) =
                    (&ty_def.name, &ty_def.kind)
                {
                    Some((id, Self::convert_name(name, true)))
                } else {
                    None
                }
            })
            .collect();

        for (id, name) in record_and_union_ids {
            let component = self.convert_type(&Type::Id(id), name.clone())?;
            if let ComponentFieldEnum::Composite(tuple_field) = component {
                top_level_structs.insert(name, tuple_field);
            } else {
                bail!("Expected top-level record '{}' to be a tuple.", name);
            }
        }
        Ok(top_level_structs)
    }

    /// Converts a WIT `Type` into a `ComponentFieldEnum`, which corresponds to the JSON schema.
    fn convert_type(&mut self, ty: &Type, field_name: String) -> Result<ComponentFieldEnum> {
        match ty {
            // --- Primitives ---
            Type::Bool
            | Type::U8
            | Type::U16
            | Type::U32
            | Type::U64
            | Type::S8
            | Type::S16
            | Type::S32
            | Type::S64
            | Type::Char
            | Type::F32
            | Type::F64 => {
                let (type_str, size_in_bits) = self.get_primitive_type_info(ty)?;
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    r#type: type_str,
                    size: Some(size_in_bits),
                }))
            }
            Type::String => Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                name: field_name,
                r#type: "string".to_string(),
                size: None,
            })),
            Type::Id(id) => self.convert_typedef(*id, field_name),
            Type::ErrorContext => todo!(),
        }
    }

    /// Converts `snake-case` names to `camelCase` or `PascalCase`
    pub fn convert_name(name: &str, pascal: bool) -> String {
        use convert_case::{Case, Casing};

        name.from_case(Case::Kebab)
            .to_case(if pascal { Case::Pascal } else { Case::Camel })
    }

    fn type_or_none(ty: Option<ComponentFieldEnum>, name: String) -> ComponentFieldEnum {
        ty.unwrap_or(ComponentFieldEnum::Primitive(PrimitiveField {
            name,
            r#type: "none".to_string(),
            size: Some(0),
        }))
    }

    /// Converts a `TypeDef` referenced by a `TypeId`. Handles memoization and complex types.
    fn convert_typedef(&mut self, id: TypeId, field_name: String) -> Result<ComponentFieldEnum> {
        if let Some(cached) = self.memo.get(&id) {
            let mut cloned = cached.clone();
            match &mut cloned {
                ComponentFieldEnum::Primitive(p) => p.name = field_name,
                ComponentFieldEnum::Composite(c) => c.name = field_name,
            }
            return Ok(cloned);
        }

        let type_def = &self.resolve.types[id];
        let result = match &type_def.kind {
            // Structs/Tuples
            TypeDefKind::Record(record) => {
                let mut components = Vec::new();
                for field in &record.fields {
                    let name = Self::convert_name(&field.name, false);
                    components.push(self.convert_type(&field.ty, name)?);
                }
                Ok(ComponentFieldEnum::Composite(CompositeField {
                    name: field_name,
                    r#type: "tuple".to_string(),
                    components,
                }))
            }
            // Unions
            TypeDefKind::Variant(variant) => {
                let mut components = Vec::new();
                for case in &variant.cases {
                    let name = Self::convert_name(&case.name, false);
                    components.push(Self::type_or_none(
                        case.ty
                            .as_ref()
                            .map(|ty| self.convert_type(ty, name.clone()))
                            .transpose()?,
                        name,
                    ));
                }
                Ok(ComponentFieldEnum::Composite(CompositeField {
                    name: field_name,
                    r#type: "union".to_string(),
                    components,
                }))
            }
            // Enums (no payload) — represent as a union of named "none" cases
            TypeDefKind::Enum(en) => {
                let components = en
                    .cases
                    .iter()
                    .map(|c| Self::type_or_none(None, Self::convert_name(&c.name, false)))
                    .collect();
                Ok(ComponentFieldEnum::Composite(CompositeField {
                    name: field_name,
                    r#type: "union".to_string(),
                    components,
                }))
            }
            // Tuples — ordered unnamed fields
            TypeDefKind::Tuple(tup) => {
                let mut components = Vec::with_capacity(tup.types.len());
                for (i, t) in tup.types.iter().enumerate() {
                    components.push(self.convert_type(t, format!("item{}", i))?);
                }
                Ok(ComponentFieldEnum::Composite(CompositeField {
                    name: field_name,
                    r#type: "tuple".to_string(),
                    components,
                }))
            }
            // Flags — map to a uint of appropriate bit width
            TypeDefKind::Flags(flags) => {
                let bits = match flags.repr() {
                    FlagsRepr::U8 => 8u32,
                    FlagsRepr::U16 => 16u32,
                    FlagsRepr::U32(n) => (n as u32) * 32u32,
                };
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    r#type: format!("uint{}", bits),
                    size: Some(bits),
                }))
            }
            TypeDefKind::Option(ty) => Ok(ComponentFieldEnum::Composite(CompositeField {
                name: field_name,
                r#type: "union".to_string(),
                components: vec![
                    ComponentFieldEnum::Primitive(PrimitiveField {
                        name: "none".to_string(),
                        r#type: "none".to_string(),
                        size: Some(0),
                    }),
                    self.convert_type(ty, "some".to_string())?,
                ],
            })),
            TypeDefKind::Result(Result_ { ok, err }) => {
                Ok(ComponentFieldEnum::Composite(CompositeField {
                    name: field_name,
                    r#type: "union".to_string(),
                    components: vec![
                        Self::type_or_none(
                            ok.as_ref()
                                .map(|ty| self.convert_type(ty, "ok".to_string()))
                                .transpose()?,
                            "ok".to_string(),
                        ),
                        Self::type_or_none(
                            err.as_ref()
                                .map(|ty| self.convert_type(ty, "err".to_string()))
                                .transpose()?,
                            "err".to_string(),
                        ),
                    ],
                }))
            }
            // Dynamic Arrays
            TypeDefKind::List(inner_ty) => {
                let (inner_type_str, _) = self.get_unnamed_type_info(inner_ty)?;
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    // NOTE: Solidity array syntax `T[]` for lists
                    r#type: format!("{}[]", inner_type_str),
                    size: None,
                }))
            }
            // Fixed-Size Arrays
            TypeDefKind::FixedSizeList(inner_ty, len) => {
                let (inner_type_str, inner_size_opt) = self.get_unnamed_type_info(inner_ty)?;
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    // NOTE: Solidity array syntax `T[N]` for vectors
                    r#type: format!("{}[{}]", inner_type_str, len),
                    // NOTE: Size of the inner element, not the whole array
                    size: inner_size_opt,
                }))
            }
            // Type Aliases
            TypeDefKind::Type(t) => {
                // For an alias like `type MyU64 = u64`, we resolve `u64` but keep the name `MyU64`.
                let mut component = self.convert_type(t, field_name)?;
                if let Some(alias_name) = &type_def.name {
                    match &mut component {
                        ComponentFieldEnum::Primitive(p) => p.r#type = alias_name.clone(),
                        ComponentFieldEnum::Composite(c) => c.r#type = alias_name.clone(),
                    }
                }
                Ok(component)
            }
            // Handles to resources (own/borrow)
            TypeDefKind::Handle(handle) => {
                let ty_str = self.get_handle_type_str(handle);
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    r#type: ty_str,
                    size: None,
                }))
            }
            // Opaque resource definitions — expose as resource<PascalName>
            TypeDefKind::Resource => {
                let res_name = type_def
                    .name
                    .as_deref()
                    .map(|n| Self::convert_name(n, true))
                    .unwrap_or_else(|| "Resource".to_string());
                Ok(ComponentFieldEnum::Primitive(PrimitiveField {
                    name: field_name,
                    r#type: format!("resource<{}>", res_name),
                    size: None,
                }))
            }
            // NOTE: We *could* translate all the other types to `bytes` or another Ethereum primitive type,
            //       but it's *better* to just flat-out disallow them.
            _ => {
                let name = type_def.name.as_deref().unwrap_or("anonymous");
                bail!(
                    "Unsupported type kind '{:?}' for type '{}'",
                    type_def.kind,
                    name
                );
            }
        };

        if let Ok(res) = &result {
            self.memo.insert(id, res.clone());
        }
        result
    }

    fn get_handle_type_str(&self, handle: &Handle) -> String {
        let res_id = match handle {
            Handle::Own(id) | Handle::Borrow(id) => id,
        };
        let res = &self.resolve.types[*res_id];
        let res_name = res
            .name
            .as_deref()
            .map(|n| Self::convert_name(n, true))
            .unwrap_or_else(|| "Resource".to_string());
        match handle {
            Handle::Own(_) => format!("own<{}>", res_name),
            Handle::Borrow(_) => format!("borrow<{}>", res_name),
        }
    }

    /// Helper to get basic info for primitive types, conforming to TS assumptions.
    fn get_primitive_type_info(&self, ty: &Type) -> Result<(String, u32)> {
        Ok(match ty {
            Type::Bool => ("bool".to_string(), 8), // SSZ pads bools to 1 byte
            Type::U8 => ("uint8".to_string(), 8),
            Type::U16 => ("uint16".to_string(), 16),
            Type::U32 => ("uint32".to_string(), 32),
            Type::U64 => ("uint64".to_string(), 64),
            Type::S8 => ("int8".to_string(), 8),
            Type::S16 => ("int16".to_string(), 16),
            Type::S32 => ("int32".to_string(), 32),
            Type::S64 => ("int64".to_string(), 64),
            Type::F32 => ("bytes4".to_string(), 32), // Represent floats as fixed bytes
            Type::F64 => ("bytes8".to_string(), 64),
            Type::Char => ("bytes4".to_string(), 32), // WIT chars are 4 bytes
            _ => bail!("Not a primitive type: {:?}", ty),
        })
    }

    /// Helper to get a type's string representation without a field name.
    fn get_unnamed_type_info(&self, ty: &Type) -> Result<(String, Option<u32>)> {
        match ty {
            Type::String => Ok(("string".to_string(), None)),
            Type::Id(id) => {
                let ty_def = &self.resolve.types[*id];
                if let Some(name) = &ty_def.name {
                    // NOTE: base-case for the type-info, rename `kebab-case` to `PascalCase` here
                    return Ok((Self::convert_name(name, true), None)); // Cannot know size of a named alias easily
                }
                match &ty_def.kind {
                    TypeDefKind::List(inner) => {
                        let (inner_name, _) = self.get_unnamed_type_info(inner)?;
                        Ok((format!("{}[]", inner_name), None))
                    }
                    TypeDefKind::FixedSizeList(inner, len) => {
                        let (inner_name, inner_size) = self.get_unnamed_type_info(inner)?;
                        Ok((format!("{}[{}]", inner_name, len), inner_size))
                    }
                    TypeDefKind::Enum(_) => Ok(("enum".to_string(), None)),
                    TypeDefKind::Tuple(t) => Ok((format!("tuple<{}>", t.types.len()), None)),
                    TypeDefKind::Flags(flags) => {
                        let bits = match flags.repr() {
                            FlagsRepr::U8 => 8u32,
                            FlagsRepr::U16 => 16u32,
                            FlagsRepr::U32(n) => (n as u32) * 32u32,
                        };
                        Ok((format!("uint{}", bits), Some(bits)))
                    }
                    TypeDefKind::Handle(h) => Ok((self.get_handle_type_str(h), None)),
                    TypeDefKind::Resource => Ok(("resource".to_string(), None)),
                    TypeDefKind::Type(t) => self.get_unnamed_type_info(t),
                    _ => Ok(("unsupported".to_string(), None)),
                }
            }
            _ => {
                let (s, sz) = self.get_primitive_type_info(ty)?;
                Ok((s, Some(sz)))
            }
        }
    }
}
