import React from 'react';

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
} from './Command';

export default {
  title: 'Components/Command',
  component: Command,
  parameters: {
    layout: 'centered',
  },
};

export const DefaultCommand = () => (
  <Command className="w-80 border border-neutral-200 rounded-sm p-2">
    <div className="relative">
      <CommandInput
        className="command__input pl-4 h-8 border border-neutral-200"
        placeholder="Type a command..."
      />
    </div>
    <CommandList>
      <CommandGroup>
        <CommandItem className="flex justify-between items-center">
          <span>Copy</span>
          <span className="font-bold">Ctrl+C</span>
        </CommandItem>
        <CommandItem className="flex justify-between items-center">
          <span>Paste</span>
          <span className="font-bold">Ctrl+V</span>
        </CommandItem>
        <CommandItem className="flex justify-between items-center">
          <span>Cut</span>
          <span className="font-bold">Ctrl+X</span>
        </CommandItem>
      </CommandGroup>
      <CommandEmpty>No commands found.</CommandEmpty>
    </CommandList>
  </Command>
);

export const CommandWithCategories = () => (
  <Command className="command-story w-80 border border-neutral-200 rounded-sm p-2">
    <div className="command__input-container relative">
      <CommandInput
        className="command__input pl-4 h-8 border border-neutral-200"
        placeholder="Search..."
      />
    </div>
    <CommandList className="command__list">
      <CommandGroup className="command__group">
        <CommandItem className="command__item font-bold">
          General
          <CommandShortcut className="ml-auto font-bold">
            Ctrl+G
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator className="command__separator bg-neutral-200" />
      <CommandGroup className="command__group ml-4">
        <CommandItem className="command__item">
          Settings
          <CommandShortcut className="ml-auto font-bold">
            Ctrl+S
          </CommandShortcut>
        </CommandItem>
        <CommandItem className="command__item">
          Profile
          <CommandShortcut className="ml-auto font-bold">
            Ctrl+P
          </CommandShortcut>
        </CommandItem>
        <CommandItem className="command__item">
          Logout
          <CommandShortcut className="ml-auto font-bold">
            Ctrl+L
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandEmpty className="command__empty">
        No categories found.
      </CommandEmpty>
    </CommandList>
  </Command>
);
