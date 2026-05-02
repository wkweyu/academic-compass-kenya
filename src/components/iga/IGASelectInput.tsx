import type { ChangeEventHandler } from 'react';

export function IGASelectInput({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      aria-label={placeholder}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
      value={value}
      onChange={onChange}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
