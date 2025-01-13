import React from 'react';
import { FileTree } from '@blocksense/docs-theme';
import { ghContractFolder } from '@/src/constants';

type TreeNode = {
  name: string;
  children?: TreeNode[];
  id: number;
  path: string;
};

export const renderTree = ({ name, children, id, path }: TreeNode) => {
  const constructedHref = `${ghContractFolder}contracts/${path}`; //use it after our repo is public on GitHub
  if (children) {
    return (
      <FileTree.Folder name={name} key={id} defaultOpen>
        {children.map(renderTree)}
      </FileTree.Folder>
    );
  } else {
    return <FileTree.File name={name} key={id} href={'/coming-soon'} />;
  }
};

export const ContractsFileTree = ({ data }: Record<string, any>) => {
  return <FileTree key={data['id']}>{renderTree(data)}</FileTree>;
};
