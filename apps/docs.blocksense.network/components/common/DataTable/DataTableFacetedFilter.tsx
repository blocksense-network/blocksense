'use client';

import * as React from 'react';

import { Button } from '@blocksense/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@blocksense/ui/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@blocksense/ui/Popover';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';
import { Checkbox } from '@blocksense/ui/Checkbox';
import { Separator } from '@blocksense/ui';

interface DataTableFacetedFilterProps {
  title: string;
  options: string[];
  selectedValues: string[];
  setSelectedValuesAction: (values: string[]) => void;
}

export function DataTableFacetedFilter({
  title,
  options,
  selectedValues = [],
  setSelectedValuesAction,
}: DataTableFacetedFilterProps) {
  const handleCheckboxChange = (option: string) => {
    if (selectedValues.includes(option)) {
      setSelectedValuesAction(selectedValues.filter(value => value !== option));
    } else {
      setSelectedValuesAction([...selectedValues, option]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger>
        <Button
          variant="outline"
          size="sm"
          className="h-8 mt-0 border-neutral-200 bg-white dark:bg-neutral-600"
        >
          {title}
          <ImageWrapper
            src="/icons/chevron-down.svg"
            alt="Chevron down"
            className="ml-1 h-4 w-4 invert"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px]">
        <Command className="py-2">
          <CommandInput className="my-1 h-1 px-2" placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map(option => {
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => handleCheckboxChange(option)}
                  >
                    <Checkbox
                      id={option}
                      value={option}
                      checked={selectedValues.includes(option)}
                      onChange={() => handleCheckboxChange(option)}
                    >
                      {option}
                    </Checkbox>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <Separator className="command__separator" />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => setSelectedValuesAction([])}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
