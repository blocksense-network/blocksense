'use client';

import * as React from 'react';

import { cn } from '@blocksense/ui/utils';
import { Button } from '@blocksense/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@blocksense/ui/Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@blocksense/ui/Popover';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

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
                const isSelected = selectedValues.includes(option);
                return (
                  <CommandItem
                    key={option}
                    onSelect={() => {
                      if (isSelected) {
                        setSelectedValuesAction(
                          selectedValues.filter(v => v !== option),
                        );
                      } else {
                        setSelectedValuesAction([...selectedValues, option]);
                      }
                    }}
                  >
                    <aside
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-xs border border-solid border-neutral-400 dark:border-neutral-600 invert',
                      )}
                    >
                      {isSelected && (
                        <ImageWrapper
                          src="/icons/check.svg"
                          alt="Check"
                          className="h4 w-4"
                        />
                      )}
                    </aside>
                    {option}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
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
