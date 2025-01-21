import {
  EnumDefinition,
  ErrorDefinition,
  EventDefinition,
  FunctionDefinition,
  ModifierDefinition,
  ParameterList,
  StructDefinition,
  VariableDeclaration,
  Literal,
  UserDefinedValueTypeDefinition,
  UsingForDirective,
  SourceUnit,
  StateMutability,
  ContractDefinition,
  ImportDirective,
  PragmaDirective,
  Visibility,
  Mutability,
  TypeDescriptions,
} from 'solidity-ast';
import { SolcInput, SolcOutput } from 'solidity-ast/solc';

import type { AbiStruct } from 'web3-types';

export enum OutputFormat {
  Raw = 'raw',
  Fine = 'fine',
  Both = 'both',
}

export interface BuildArtifacts {
  input: SolcInput;
  output: SolcOutput;
  artifactsPaths: string[];
  artifactPath: string;
}

export type NodeType =
  | 'ErrorDefinition'
  | 'EventDefinition'
  | 'FunctionDefinition'
  | 'ModifierDefinition'
  | 'VariableDeclaration'
  | 'EnumDefinition'
  | 'StructDefinition'
  | 'PragmaDirective';

export type ContractKind = 'contract' | 'library' | 'interface';

export type TypeKind = 'enum' | 'struct';

export type FunctionType =
  | 'function'
  | 'receive'
  | 'constructor'
  | 'fallback'
  | 'freeFunction';

export type FunctionModifierKind =
  | 'modifierInvocation'
  | 'baseConstructorSpecifier';

export type Signature = {
  codeSnippet: string;
  overviewCodeSnippet?: string;
  type?: NodeType;
};

export type NatSpecParam = {
  name?: string;
  description: string;
};

export interface NatSpec {
  author?: string;
  title?: string;
  notice?: string;
  dev?: string;
  params?: NatSpecParam[];
  returns?: NatSpecParam[];
  custom?: {
    [tag: string]: string;
  };
  inheritdoc?: {
    name: string;
    sourceContract: string;
  };
}

export type WithNatspec<T> = T & { natspec?: NatSpec };

export type ASTNode =
  | WithNatspec<SourceUnit>
  | WithNatspec<ContractDefinition>
  | WithNatspec<EnumDefinition>
  | WithNatspec<ErrorDefinition>
  | WithNatspec<EventDefinition>
  | WithNatspec<FunctionDefinition>
  | WithNatspec<ModifierDefinition>
  | WithNatspec<StructDefinition>
  | WithNatspec<UserDefinedValueTypeDefinition>
  | WithNatspec<UsingForDirective>
  | WithNatspec<VariableDeclaration>
  | WithNatspec<PragmaDirective>
  | WithNatspec<ImportDirective>
  | WithNatspec<ParameterList>
  | WithNatspec<Literal>;

export type SolReflection = { rawData: ASTNode; fineData: SourceUnitDocItem }[];

export type ContractElement =
  | FunctionDocItem
  | ErrorDocItem
  | EventDocItem
  | ModifierDocItem
  | VariableDocItem
  | EnumDocItem
  | StructDocItem;

export type DocItemConstructor<T> = new (...args: any[]) => T;

export class SourceUnitDocItem {
  absolutePath: string = '';
  license?: string;
  pragmas: PragmaDocItem[] = [];
  contracts?: ContractDocItem[];
  enums?: EnumDocItem[];
  errors?: ErrorDocItem[];
  functions?: FunctionDocItem[];
  structs?: StructDocItem[];
  variables?: VariableDocItem[];
}

export class ContractDocItem {
  name: string = '';
  contractKind: ContractKind = 'contract';
  abstract: boolean = false;
  abi: AbiStruct[] = [{ name: '', type: '', inputs: [] }];
  natspec: NatSpec = {};
  _baseContracts: string[] = [];
  functions?: FunctionDocItem[];
  errors?: ErrorDocItem[];
  events?: EventDocItem[];
  modifiers?: ModifierDocItem[];
  variables?: VariableDocItem[];
  enums?: EnumDocItem[];
  structs?: StructDocItem[];
  signature?: Signature;
}

export class ErrorDocItem {
  name: string = '';
  errorSelector: string = '';
  signature?: Signature;
  abi: AbiStruct = { name: '', type: '', inputs: [] };
  _parameters?: VariableDocItem[];
  natspec: NatSpec = {};
}

export class EventDocItem {
  name: string = '';
  eventSelector: string = '';
  signature?: Signature;
  abi: AbiStruct = { name: '', type: '', inputs: [] };
  anonymous: boolean = false;
  _parameters?: VariableDocItem[];
  natspec: NatSpec = {};
}

export class FunctionDocItem {
  name: string = '';
  kind: FunctionType = 'function';
  functionSelector: string = '';
  signature?: Signature;
  abi: AbiStruct = { name: '', type: '', inputs: [] };
  visibility: Visibility = 'external';
  stateMutability: StateMutability = 'payable';
  virtual: boolean = true;
  _parameters?: VariableDocItem[];
  _returnParameters?: VariableDocItem[];
  _modifiers?: FunctionModifierDocItem[];
  natspec: NatSpec = {};
}

export class FunctionModifierDocItem {
  _modifierName: string = '';
  kind: FunctionModifierKind = 'modifierInvocation';
}

export class ModifierDocItem {
  name: string = '';
  visibility: Visibility = 'external';
  signature?: Signature;
  _parameters?: VariableDocItem[];
  natspec: NatSpec = {};
}

export class VariableDocItem {
  name: string = '';
  typeDescriptions: TypeDescriptions = {};
  signature?: Signature;
  abi?: AbiStruct = { name: '', type: '', inputs: [] };
  mutability: Mutability = 'mutable';
  visibility: Visibility = 'external';
  _value?: string;
  indexed: boolean = false;
  constant: boolean = false;
  natspec: NatSpec = {};
  _natspecDescription?: string;
  _natspecName?: string;
  storageLocation?: 'calldata' | 'default' | 'memory' | 'storage' = 'default';
}

export class EnumDocItem {
  name: string = '';
  signature?: Signature;
  _members: string[] = [];
  natspec: NatSpec = {};
}

export class StructDocItem {
  name: string = '';
  signature?: Signature;
  visibility: Visibility = 'external';
  _members?: VariableDocItem[];
  natspec: NatSpec = {};
}

export class PragmaDocItem {
  literals: string[] = [];
}

export type TreeNode<ExtraData> = {
  name: string;
  children?: TreeNode<ExtraData>[];
} & ExtraData;

export function isLiteral(value: ASTNode): value is Literal {
  return value ? value.nodeType === 'Literal' : false;
}

export function isSourceUnit(value: ASTNode): value is SourceUnit {
  return value.nodeType === 'SourceUnit';
}

export function isContractDefinition(
  value: ASTNode,
): value is ContractDefinition {
  return value.nodeType === 'ContractDefinition';
}

export function isVariableDeclaration(
  value: ASTNode,
): value is VariableDeclaration {
  return value.nodeType === 'VariableDeclaration';
}

export function isFunctionDefinition(
  value: ASTNode,
): value is FunctionDefinition {
  return value.nodeType === 'FunctionDefinition';
}

export function isParameterList(value: ASTNode): value is ParameterList {
  return value.nodeType === 'ParameterList';
}
