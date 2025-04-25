import React, { useState } from 'react';

import { Button } from '@blocksense/ui/Button';
import { Input } from '@blocksense/ui/Input';
import { RadioGroup, RadioGroupItem } from '@blocksense/ui/RadioGroup';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from './Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from '../DropdownMenu';

export default {
  title: 'Components/Dialog',
  component: Dialog,
};

export const DefaultDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Button onClick={() => setIsOpen(true)}>Open Default Dialog</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogHeader>
        <DialogDescription className="border-1 rounded-md p-4 shadow-sm dark:border-neutral-600 border-neutral-200">
          <p className="italic"> This is a basic dialog example.</p>
        </DialogDescription>
        <DialogFooter>
          <b>Footer content</b>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ScrollableDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Button onClick={() => setIsOpen(true)}>Open Scrollable Dialog</Button>
      <DialogContent className="overflow-auto">
        <div className="h-full">
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogClose>Close</DialogClose>
          </DialogHeader>
          <DialogDescription className="max-h-[40vh] overflow-auto border-1 rounded-md p-4 shadow-sm dark:border-neutral-600 border-neutral-200">
            <div className="p-4">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i} className="mb-2">
                  This is line {i + 1} of content.
                </p>
              ))}
            </div>
          </DialogDescription>
          <DialogFooter>
            <b>Footer content</b>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DialogWithTrigger = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <DialogTrigger
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-blue-600 text-white rounded cursor-pointer"
      >
        Open Dialog with Trigger
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogHeader>
        <DialogDescription className="border-1 rounded-md p-4 shadow-sm dark:border-neutral-600 border-neutral-200">
          <p className="italic"> This is a basic dialog example.</p>
        </DialogDescription>
        <DialogFooter>
          <b>Footer content</b>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DialogWithForm = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Button onClick={() => setIsOpen(true)}>Open Dialog with Form</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogHeader>
        <DialogDescription className="max-h-[40vh] overflow-auto">
          <form className="p-4 flex flex-col gap-4">
            <Input type="text" placeholder="Name" />
            <Input type="email" placeholder="Email" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={e => {
                  e.preventDefault();
                }}
              >
                Submit
              </Button>
            </div>
          </form>
        </DialogDescription>
        <DialogFooter>
          <b>Footer content</b>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DialogWithList = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Button onClick={() => setIsOpen(true)}>Open Dialog with List</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogHeader>
        <DialogDescription className="max-h-[40vh] overflow-auto border-1 rounded-md p-4 shadow-sm dark:border-neutral-600 border-neutral-200">
          <ul className="p-4">
            {['Item 1', 'Item 2', 'Item 3', 'Item 4'].map((item, index) => (
              <li key={index} className="p-2 border-b border-b-neutral-200">
                {item}
              </li>
            ))}
          </ul>
          <div className="p-4 flex justify-end">
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        </DialogDescription>
        <DialogFooter>
          <b>Footer content</b>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DialogWithDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [optionA, setOptionA] = useState(false);
  const [optionB, setOptionB] = useState(false);
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <Button onClick={() => setIsOpen(true)}>Open Dialog with Dropdown</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogHeader>
        <DialogDescription className="max-h-[40vh] overflow-auto border-1 rounded-md p-4 shadow-sm dark:border-neutral-600 border-neutral-200">
          <div className="p-4 mb-10 flex flex-row gap-4 justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button>Select an Option</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Option 1</DropdownMenuItem>
                <DropdownMenuItem>Option 2</DropdownMenuItem>
                <DropdownMenuItem>Option 3</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button>Open Checkbox Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuCheckboxItem
                  checked={optionA}
                  onCheckedChange={setOptionA}
                >
                  {`Option A ${optionA ? '(On)' : '(Off)'}`}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={optionB}
                  onCheckedChange={setOptionB}
                >
                  {`Option B ${optionB ? '(On)' : '(Off)'}`}
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem>Another Item</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button>Open Radio Menu</Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="bottom" align="start">
                <RadioGroup
                  selectedValue={selectedOption}
                  name="option"
                  onValueChangeAction={setSelectedOption}
                  aria-label="Choose an option"
                  className="p-4"
                >
                  <RadioGroupItem value="option1">Option 1</RadioGroupItem>
                  <RadioGroupItem value="option2">Option 2</RadioGroupItem>
                  <RadioGroupItem value="option3">Option 3</RadioGroupItem>
                </RadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="p-4 flex justify-end">
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        </DialogDescription>
        <DialogFooter>
          <b>Footer content</b>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
