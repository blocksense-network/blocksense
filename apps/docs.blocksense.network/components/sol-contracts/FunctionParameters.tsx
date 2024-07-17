import * as React from 'react';
import { NatSpec, VariableDocItem } from '@blocksense/sol-reflector';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type FunctionParametersProps = {
  parameters?: VariableDocItem[];
  title?: string;
  titleLevel?: 4 | 5;
  functionNatSpec: NatSpec;
};

type FunctionNatSpecParam = {
  name?: string;
  description: string;
};

function getFunctionParameterDetails(
  functionNatSpecParams: FunctionNatSpecParam[],
  parameterName: string,
  index: number,
): FunctionNatSpecParam {
  if (parameterName) {
    const parameter = functionNatSpecParams.find(
      param => param.name === parameterName,
    );
    return {
      name: parameterName,
      description: parameter ? parameter.description : '-',
    };
  } else {
    return {
      name: functionNatSpecParams[index]?.name || 'unnamed',
      description: functionNatSpecParams[index]?.description || '-',
    };
  }
}

function getParamsFromNatspec(paramKind: string, natspec: NatSpec) {
  return (paramKind === 'Parameters' ? natspec.params : natspec.returns) || [];
}

export const FunctionParameters = ({
  parameters,
  title = '',
  titleLevel,
  functionNatSpec,
}: FunctionParametersProps) => {
  return (
    <ContractItemWrapper
      itemsLength={parameters?.length}
      title={title}
      titleLevel={titleLevel}
    >
      <Table className="variables__table">
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            <TableHead className="variables__table-head">Type</TableHead>
            <TableHead className="variables__table-head">Name</TableHead>
            <TableHead className="variables__table-head">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {parameters?.map((parameter, index) => {
            const functionNatSpecParams = getParamsFromNatspec(
              title,
              functionNatSpec,
            );
            const { name, description } = getFunctionParameterDetails(
              functionNatSpecParams,
              parameter.name,
              index,
            );

            return (
              <TableRow className="variables__table-row" key={index}>
                <TableCell className="variables__table-cell variables__table-cell--type">
                  {parameter.typeDescriptions.typeString}
                </TableCell>
                <TableCell className="variables__table-cell variables__table-cell--name">
                  {name}
                </TableCell>
                <TableCell className="variables__table-cell variables__table-cell--description">
                  {description}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
