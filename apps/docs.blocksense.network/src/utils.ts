import type { useRouter } from 'next/navigation';

import { previewHexString } from '@blocksense/base-utils/buffer-and-hex';
import { NetworkName } from '@blocksense/base-utils/evm/networks';
import type { VariableDocItem } from '@blocksense/sol-reflector';

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

export function onLinkClick(
  e: React.MouseEvent,
  router: ReturnType<typeof useRouter>,
  link: string,
  isTargetBlank?: boolean,
) {
  e.preventDefault();
  e.stopPropagation();

  if (!link) {
    return;
  }

  e.ctrlKey || e.metaKey || isTargetBlank
    ? window.open(link)
    : router.push(link);
}

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

export function previewHexStringOrDefault(
  value: string | undefined,
  defaultValue: string = '-',
  bytesToShow?: number,
): string {
  return value ? previewHexString(value, bytesToShow) : defaultValue;
}

export const capitalizeWords = (input: string): string => {
  return input
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const showMsInSeconds = (ms: number): string => {
  return `${(ms / 1000).toFixed(2)} seconds`;
};

export const showPercentage = (value: any): string => {
  return `${value} %`;
};

export function networkNameToIconName(networkName: NetworkName) {
  return networkName.split('-')[0];
}
