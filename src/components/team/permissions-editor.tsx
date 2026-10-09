import { PERMISSION_KEYS, type Permissions } from "@/lib/auth.types";
import { PERMISSION_INFO } from "@/lib/permissions";

/** Caixas de seleção do que a funcionária pode acessar. A gestora escolhe item por item. */
export function PermissionsEditor({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {PERMISSION_KEYS.map((key) => (
        <label
          key={key}
          className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--surface-card)] px-3.5 py-2"
        >
          <input
            type="checkbox"
            checked={value[key]}
            onChange={() => onChange({ ...value, [key]: !value[key] })}
            className="size-5 flex-none accent-[var(--teal)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px]">{PERMISSION_INFO[key].label}</span>
            <span className="block text-xs text-muted-foreground">{PERMISSION_INFO[key].hint}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        Equipe nunca acessa: configurações da clínica, preços dos procedimentos, credenciais e a
        gestão da própria equipe.
      </p>
    </div>
  );
}
