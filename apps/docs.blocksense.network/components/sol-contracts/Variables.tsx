import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { VariableDocItem } from '@blocksense/sol-reflector';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
};

export const Variables = ({ variables, title }: VariablesProps) => {
  return (
    <ContractItemWrapper itemsLength={variables?.length}>
      <Table className="variables__table">
        <TableCaption className="variables__table-caption">
          {title}
        </TableCaption>
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            <TableHead className="variables__table-head">Name</TableHead>
            <TableHead className="variables__table-head">Type</TableHead>
            <TableHead className="variables__table-head">Mutability</TableHead>
            <TableHead className="variables__table-head">Indexed</TableHead>
            <TableHead className="variables__table-head">Constant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {variables?.map((variable, index) => (
            <TableRow className="variables__table-row" key={index}>
              <TableCell className="variables__table-cell variables__table-cell--name w-[140px]">
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button
                      variant="secondary"
                      className="variables__button w-[140px] font-bold"
                    >
                      {variable.name ? variable.name : 'unnamed'}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="variables__drawer-content">
                    <div className="mx-auto">
                      <DrawerHeader className="variables__drawer-header">
                        <DrawerTitle className="variables__drawer-title">
                          Variable Details
                        </DrawerTitle>
                        <DrawerDescription className="variables__drawer-description">
                          Details of the selected variable.
                        </DrawerDescription>
                      </DrawerHeader>
                      <div className="mt-0 mb-6">
                        <div className="overflow-x-auto">
                          <Table className="variables__table min-w-full">
                            <TableCaption className="variables__table-caption">
                              {title}
                            </TableCaption>
                            <TableHeader className="variables__table-header">
                              <TableRow className="variables__table-header-row">
                                <TableHead className="variables__table-head">
                                  Name
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Type Identifier
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Type
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Mutability
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Value
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Indexed
                                </TableHead>
                                <TableHead className="variables__table-head">
                                  Constant
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="variables__table-body">
                              <TableRow className="variables__table-row">
                                <TableCell className="variables__table-cell variables__table-cell--name">
                                  {variable.name ? variable.name : 'unnamed'}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--type">
                                  {variable.typeDescriptions.typeIdentifier}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--type">
                                  {variable.typeDescriptions.typeString}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--mutability">
                                  {variable.mutability}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--value">
                                  {variable._value}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--indexed">
                                  {variable.indexed.toString()}
                                </TableCell>
                                <TableCell className="variables__table-cell variables__table-cell--constant">
                                  {variable.constant.toString()}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <DrawerFooter className="variables__drawer-footer hidden">
                        <DrawerClose asChild>
                          <Button
                            variant="outline"
                            className="variables__button"
                          >
                            Close
                          </Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </div>
                  </DrawerContent>
                </Drawer>
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--type">
                {variable.typeDescriptions.typeString}
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--mutability">
                {variable.mutability}
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--indexed">
                {variable.indexed.toString()}
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--constant">
                {variable.constant.toString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
