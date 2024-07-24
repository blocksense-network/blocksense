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
