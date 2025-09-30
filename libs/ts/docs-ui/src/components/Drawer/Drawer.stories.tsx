import React, { useState } from 'react';

import { Button } from '@blocksense/docs-ui/Button';
import { Input } from '@blocksense/docs-ui/Input';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../DropdownMenu';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './Drawer';

export default {
  title: 'Components/Drawer',
  component: Drawer,
};

export const DefaultDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Drawer</Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Default Drawer</DrawerTitle>
            <DrawerDescription>
              This is a basic drawer example.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">Drawer Content Goes Here</div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const ScrollableDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Scrollable Drawer</Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Scrollable Drawer</DrawerTitle>
            <DrawerDescription>
              This drawer contains a lot of content.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 max-h-60 overflow-y-auto">
            {[...Array(20)].map((_, i) => (
              <p key={i} className="mb-2">
                This is line {i + 1} of content.
              </p>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const DrawerWithTrigger = () => {
  return (
    <div className="p-4">
      <Drawer>
        <DrawerTrigger>
          <Button>Drawer with Trigger</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Triggered Drawer</DrawerTitle>
            <DrawerDescription>
              This drawer opens using the DrawerTrigger.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">More content inside the drawer.</div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const DrawerWithForm = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Drawer with Form</Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Form Inside Drawer</DrawerTitle>
            <DrawerDescription>Submit your details below.</DrawerDescription>
          </DrawerHeader>
          <form className="p-4 flex flex-col gap-4">
            <Input type="text" placeholder="Name" />
            <Input type="email" placeholder="Email" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button>Submit</Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const DrawerWithList = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Drawer with List</Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer with List</DrawerTitle>
            <DrawerDescription>
              Select an item from the list below.
            </DrawerDescription>
          </DrawerHeader>
          <ul className="p-4">
            {['Item 1', 'Item 2', 'Item 3', 'Item 4'].map((item, index) => (
              <li key={index} className="p-2 border-b border-b-neutral-200">
                {item}
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export const DrawerWithDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setIsOpen(true)}>Open Drawer with Dropdown</Button>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer with Dropdown</DrawerTitle>
            <DrawerDescription>
              This is a drawer example with dropdown inside.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button>Items</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Item 1</DropdownMenuItem>
                <DropdownMenuItem>Item 2</DropdownMenuItem>
                <DropdownMenuItem>Item 3</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
