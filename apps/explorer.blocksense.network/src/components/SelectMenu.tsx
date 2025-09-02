import type { NetworkName } from '@blocksense/base-utils';

type SelectMenuProps = {
  selected: NetworkName | null;
  options: Array<NetworkName>;
  onChange: (value: NetworkName) => void;
};

export function SelectMenu({ onChange, options, selected }: SelectMenuProps) {
  return (
    <select
      className="py-2 px-4 border border-none rounded-[100px] outline-none text-[var(--light-gray)] focus:ring-0 bg-[var(--gray)] appearance-none max-w-max"
      value={selected ?? ''}
      onChange={e => onChange(e.target.value as NetworkName)}
    >
      <option value="" disabled>
        Select a network
      </option>
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
