import React from 'react';

import {
  Table,
  TableCaption,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from './Table';

export default {
  title: 'Components/Table',
  component: Table,
};

export const DefaultTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>ID</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>1</TableCell>
        <TableCell>John Doe</TableCell>
        <TableCell>john@example.com</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>2</TableCell>
        <TableCell>Jane Doe</TableCell>
        <TableCell>jane@example.com</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>3</TableCell>
        <TableCell>Sam Smith</TableCell>
        <TableCell>sam@example.com</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const TableWithCaption = () => (
  <Table>
    <TableCaption>User Information</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>ID</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>1</TableCell>
        <TableCell>John Doe</TableCell>
        <TableCell>john@example.com</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>2</TableCell>
        <TableCell>Jane Doe</TableCell>
        <TableCell>jane@example.com</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>3</TableCell>
        <TableCell>Sam Smith</TableCell>
        <TableCell>sam@example.com</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);

export const TableWithFooter = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Product</TableHead>
        <TableHead>Price</TableHead>
        <TableHead>Quantity</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Apple</TableCell>
        <TableCell>$1</TableCell>
        <TableCell>10</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Banana</TableCell>
        <TableCell>$0.50</TableCell>
        <TableCell>20</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Orange</TableCell>
        <TableCell>$0.75</TableCell>
        <TableCell>15</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell className="font-bold">Total</TableCell>
        <TableCell />
        <TableCell className="font-bold">45</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);

export const WideTable = () => (
  <Table containerClassName="max-w-full">
    <TableHeader>
      <TableRow>
        {Array.from({ length: 10 }, (_, i) => (
          <TableHead key={i}>Header {i + 1}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: 10 }, (_, colIndex) => (
            <TableCell key={colIndex}>
              Cell {rowIndex + 1}-{colIndex + 1}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const ScrollableTable = () => (
  <Table containerClassName="max-h-64 w-[400px] overflow-auto">
    <TableHeader>
      <TableRow>
        {Array.from({ length: 20 }, (_, i) => (
          <TableHead key={i}>Header {i + 1}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 20 }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: 20 }, (_, colIndex) => (
            <TableCell key={colIndex}>
              Row {rowIndex + 1} - Col {colIndex + 1}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
