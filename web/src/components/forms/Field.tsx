import { useMemo } from 'react';

import { useCatalogo } from '../../api/catalogos';
import type { CatalogoSlug, FieldDefinition } from '../../lib/types';
import { FieldShell } from '../ui/FieldShell';
import { Input } from '../ui/Input';
import { RadioGroup } from '../ui/RadioGroup';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

type FieldProps = {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * Dispatcher que convierte una FieldDefinition en su control UI segun kind.
 */
export function Field({ field, value, onChange, error, disabled }: FieldProps) {
  const id = `f_${field.name}`;
  const common = { label: field.label, htmlFor: id, description: field.description, required: field.required, error };

  switch (field.type.kind) {
    case 'text': {
      const type = field.type;
      return (
        <FieldShell {...common}>
          <Input
            id={id}
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={type.maxLength}
            placeholder={type.placeholder}
            disabled={disabled}
            invalid={Boolean(error)}
            style={type.uppercase ? { textTransform: 'uppercase' } : undefined}
          />
        </FieldShell>
      );
    }

    case 'textarea': {
      const type = field.type;
      return (
        <FieldShell {...common}>
          <Textarea
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            maxLength={type.maxLength}
            placeholder={type.placeholder}
            disabled={disabled}
            invalid={Boolean(error)}
          />
        </FieldShell>
      );
    }

    case 'number': {
      const type = field.type;
      return (
        <FieldShell {...common}>
          <Input
            id={id}
            type="number"
            inputMode={type.integer ? 'numeric' : 'decimal'}
            step={type.integer ? 1 : 'any'}
            min={type.min}
            max={type.max}
            value={typeof value === 'number' || typeof value === 'string' ? value : ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === '' ? undefined : raw);
            }}
            onKeyDown={(e) => {
              // Bloquea caracteres no validos para integer/sin negativos
              if (type.integer && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
              }
              if (!type.allowNegative && type.min === undefined && e.key === '-') {
                e.preventDefault();
              }
            }}
            disabled={disabled}
            invalid={Boolean(error)}
          />
        </FieldShell>
      );
    }

    case 'radio': {
      const type = field.type;
      return (
        <FieldShell {...common}>
          <RadioGroup
            name={field.name}
            value={typeof value === 'string' ? value : undefined}
            onChange={onChange}
            options={type.options}
            disabled={disabled}
            invalid={Boolean(error)}
            columns={type.options.length <= 2 ? 2 : 1}
          />
        </FieldShell>
      );
    }

    case 'select': {
      const type = field.type;
      return (
        <FieldShell {...common}>
          <Select
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            options={type.options}
            placeholder="Selecciona una opcion"
            disabled={disabled}
            invalid={Boolean(error)}
          />
        </FieldShell>
      );
    }

    case 'searchable-select': {
      return (
        <SearchableField
          id={id}
          common={common}
          source={field.type.source}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    }
  }
}

type CommonShellProps = {
  label: string;
  htmlFor: string;
  description?: string;
  required: boolean;
  error?: string;
};

function SearchableField({
  id,
  common,
  source,
  value,
  onChange,
  disabled,
}: {
  id: string;
  common: CommonShellProps;
  source: CatalogoSlug;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const query = useCatalogo(source);
  const options = useMemo(() => query.data?.options ?? [], [query.data]);

  return (
    <FieldShell {...common}>
      <SearchableSelect
        id={id}
        value={typeof value === 'string' ? value : undefined}
        onChange={(v) => onChange(v)}
        options={options}
        isLoading={query.isPending}
        invalid={Boolean(common.error)}
        disabled={disabled}
        placeholder="Buscar..."
      />
    </FieldShell>
  );
}
