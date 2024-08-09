import React from 'react';
import { FileTree } from 'nextra/components';

type TreeNode = {
  name: string;
  children?: TreeNode[];
  id: number;
};

export const renderTree = ({ name, children, id }: TreeNode) => {
  if (children) {
    return (
      <FileTree.Folder name={name} key={id} defaultOpen>
        {children.map(renderTree)}
      </FileTree.Folder>
    );
  } else {
    return <FileTree.File name={name} key={id} />;
  }
};

export const ContractsFileTree = ({ data }: Record<string, any>) => {
  return <FileTree key={data['id']}>{renderTree(data)}</FileTree>;
};
