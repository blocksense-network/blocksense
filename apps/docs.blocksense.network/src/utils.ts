import { FilterType, OptionType } from '@/components/ui/DataTable/DataTable';
import { VariableDocItem } from '@blocksense/sol-reflector';

export const filterConstants = (
  variables: VariableDocItem[] = [],
): VariableDocItem[] => {
  return variables.filter(v => v.constant);
};

export const filterVariables = (
  variables: VariableDocItem[] = [],
): VariableDocItem[] => {
  return variables.filter(v => v.constant === false);
};

export function stringifyObject(obj: any): string {
  return `'${JSON.stringify(obj)
    .replace(/\\n/g, '\\\\n')
    .replace(/\\'/g, "\\\\'")
    .replace(/\\"/g, '\\\\"')
    .replace(/\\&/g, '\\\\&')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
    .replace(/\\b/g, '\\\\b')
    .replace(/\\f/g, '\\\\f')}'`;
}
