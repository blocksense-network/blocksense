import React from 'react';

import { FileTree } from 'nextra/components';
import Link from 'next/link';

import { ghContractFolder } from '@/src/constants';

type TreeNode = {
  name: string;
  children?: TreeNode[];
  id: number;
  path: string;
};

export const renderTree = ({ name, children, id, path }: TreeNode) => {
  const constructedHref = `${ghContractFolder}contracts/${path}`;

  if (children) {
    return (
      <FileTree.Folder name={<span>{name}</span>} key={id} defaultOpen>
        {children.map(renderTree)}
      </FileTree.Folder>
    );
  } else {
    return (
      <Link href={constructedHref} target="_blank" rel="noopener noreferrer">
        <FileTree.File name={<span>{name}</span>} key={id} />
      </Link>
    );
  }
};

export const ContractsFileTree = ({ data }: Record<string, any>) => {
  return <FileTree key={data['id']}>{renderTree(data)}</FileTree>;
};
