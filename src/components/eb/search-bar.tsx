import { Icon } from "@/components/eb/icon";

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Buscar cliente",
}: {
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3.5 text-muted-foreground">
        <Icon name="Search" size={17} />
      </span>
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-full border border-[var(--border-card)] bg-[var(--surface-field)] pl-[42px] pr-11 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar busca"
          className="absolute right-1 grid size-11 place-items-center rounded-full text-muted-foreground"
        >
          <Icon name="X" size={15} />
        </button>
      ) : null}
    </div>
  );
}
