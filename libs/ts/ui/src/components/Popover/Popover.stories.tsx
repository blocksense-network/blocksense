import React from 'react';

import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
} from '../Command';
import { Button } from '../Button';

const CommandContent = () => (
  <Command className="command-story">
    <div className="command__input-container mt-2">
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

export default {
  title: 'Components/Popover',
  component: Popover,
};

export const DefaultPopover = () => (
  <Popover>
    <PopoverTrigger>
      <Button
        variant="outline"
        size="sm"
        className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
      >
        Open Popover
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[300px]">
      <CommandContent />
    </PopoverContent>
  </Popover>
);

export const SideAlignExamples = () => (
  <div className="flex flex-col gap-10">
    <div className="flex items-center gap-10">
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Bottom Start (default)
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Bottom Center
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Bottom End
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
    </div>

    <div className="flex items-center gap-10">
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Top Start
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Top Center
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Top End
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
    </div>

    <div className="flex items-center gap-10">
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Left Start
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Left Center
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="center" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Left End
          </Button>
        </PopoverTrigger>
        <PopoverContent side="left" align="end" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
    </div>

    <div className="flex items-center gap-10">
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Right Start
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Right Center
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="center" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            className="h-8 mt-0 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
          >
            Right End
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-[300px]">
          <CommandContent />
        </PopoverContent>
      </Popover>
    </div>
  </div>
);
