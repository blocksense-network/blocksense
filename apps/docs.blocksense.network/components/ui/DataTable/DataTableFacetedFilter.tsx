'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
          className="h-8 border border-solid border-neutral-200/70 bg-white dark:bg-neutral-900"
        >
          {title}
          <ChevronDown className="ml-1 h-4 w-4" />
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
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-xs border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible border-solid border-slate-500',
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
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
