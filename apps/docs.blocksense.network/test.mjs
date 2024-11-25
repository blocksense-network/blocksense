// export {}

const theguild = import.meta.resolve('@theguild/remark-mermaid');
const mermaid = import.meta.resolve('mermaid', theguild);
const mermaid_js_parser = import.meta.resolve('@mermaid-js/parser', mermaid);
const langium = import.meta.resolve('langium', mermaid_js_parser);
// const vscode_languageserver_types = import.meta.resolve('vscode-languageserver-types', langium);
const vscode_languageserver = import.meta.resolve(
  'vscode-languageserver',
  langium,
);
const vscode_languageserver_protocol = import.meta.resolve(
  'vscode-languageserver-protocol',
  vscode_languageserver,
);
const vscode_languageserver_types = import.meta.resolve(
  'vscode-languageserver-types',
  vscode_languageserver_protocol,
);
const parser = import.meta.resolve(
  'vscode-languageserver-types',
  vscode_languageserver_protocol,
);
const vscode_jsonrpc = import.meta.resolve(
  'vscode-jsonrpc',
  vscode_languageserver_protocol,
);

// const source = langium + '/lib/parser/async-parser.js';
// const target = langium + '/lib/utils/event.js';
// const res = import.meta.resolve(target, source);

console.log({ vscode_jsonrpc });
// console.log({ langium });
// console.log({ source });
