import React, { useState } from 'react';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
} from './Select';

export default {
  title: 'Components/Select',
  component: Select,
};

export const DefaultSelect = () => {
  const [selectedValue, setSelectedValue] = useState('');

  return (
    <Select value={selectedValue} onValueChangeAction={setSelectedValue}>
      <SelectTrigger className="btn">
        <SelectValue placeholder="Select an Item" />
      </SelectTrigger>
      <SelectContent>
        <SelectLabel>Items</SelectLabel>
        <SelectItem value="Item 1">Item 1</SelectItem>
        <SelectItem value="Item 2">Item 2</SelectItem>
        <SelectItem value="Item 3">Item 3</SelectItem>
      </SelectContent>
    </Select>
  );
};

export const SideAlignExamples = () => {
  const [defaultValue, setDefaultValue] = useState('');
  const [bottomCenterValue, setBottomCenterValue] = useState('');
  const [bottomEndValue, setBottomEndValue] = useState('');
  const [topStartValue, setTopStartValue] = useState('');
  const [topCenterValue, setTopCenterValue] = useState('');
  const [topEndValue, setTopEndValue] = useState('');

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        <Select value={defaultValue} onValueChangeAction={setDefaultValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom Start (default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={bottomCenterValue}
          onValueChangeAction={setBottomCenterValue}
        >
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom Center" />
          </SelectTrigger>
          <SelectContent align="center">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bottomEndValue} onValueChangeAction={setBottomEndValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom End" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-10">
        <Select value={topStartValue} onValueChangeAction={setTopStartValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top Start" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topCenterValue} onValueChangeAction={setTopCenterValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top Center" />
          </SelectTrigger>
          <SelectContent side="top" align="center">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topEndValue} onValueChangeAction={setTopEndValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top End" />
          </SelectTrigger>
          <SelectContent side="top" align="end">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const statusOptions = ['Active', 'Inactive', 'Pending', 'Completed'];

export const SelectStatusFilter = () => {
  const [selectedStatus, setSelectedStatus] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select value={selectedStatus} onValueChangeAction={setSelectedStatus}>
        <SelectTrigger className="btn">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent side="bottom">
          {statusOptions.map(status => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
