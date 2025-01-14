import React from 'react';
// import { FileTree } from '@blocksense/docs-theme';
// import { ghContractFolder } from '@/src/constants';
import { FileTree } from 'nextra/components';

type TreeNode = {
  name: string;
  children?: TreeNode[];
  id: number;
  path: string;
};

export const renderTree = ({ name, children, id, path }: TreeNode) => {
  // const constructedHref = `${ghContractFolder}contracts/${path}`; //use it after our repo is public on GitHub
  if (children) {
    return (
      <FileTree.Folder name={<span>{name}</span>} key={id} defaultOpen>
        {children.map(renderTree)}
      </FileTree.Folder>
    );
  } else {
    return <FileTree.File name={<span>{name}</span>} key={id} />;
  }
};

export const ContractsFileTree = ({ data }: Record<string, any>) => {
  return <FileTree key={data['id']}>{renderTree(data)}</FileTree>;
};
