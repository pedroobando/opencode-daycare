'use client';

import { SearchIcon } from '@/app/components/icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Buscar niño…',
}: SearchInputProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex items-center gap-[11px] rounded-[14px] border border-card-border bg-card px-4 py-3">
      <SearchIcon className="h-[18px] w-[18px] text-placeholder-text" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-placeholder-text"
        aria-label="Buscar niño"
      />
    </div>
  );
};
