import { CheckCircle2, Send } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { ApiError } from '../../api/client';
import { useSubmitForm, type SubmitResponse } from '../../api/forms';
import type { FormPublicDefinition } from '../../lib/types';
import { toast } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from './Field';
import { normalizeValues, validateForm } from './fieldValidate';

type FormRendererProps = {
  form: FormPublicDefinition;
};

function initialValues(form: FormPublicDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of form.fields) {
    out[f.name] = undefined;
  }
  return out;
}

function formatOutputSummary(output: Record<string, unknown>): string | null {
  const entries = Object.entries(output).filter(
    ([k, v]) => k !== 'Status' && k !== 'Error' && v !== null && v !== undefined,
  );
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
}

export function FormRenderer({ form }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(form));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<SubmitResponse | null>(null);

  const mutation = useSubmitForm(form.slug);

  const errors = useMemo(() => validateForm(form.fields, values), [form.fields, values]);
  const visibleErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(errors)) {
      if (submitted || touched[k]) out[k] = v;
    }
    return out;
  }, [errors, submitted, touched]);
  const isValid = Object.keys(errors).length === 0;

  function handleChange(name: string, value: unknown): void {
    setValues((v) => ({ ...v, [name]: value }));
    setLastSuccess(null);
  }

  function handleBlur(name: string): void {
    setTouched((t) => ({ ...t, [name]: true }));
  }

  function resetForm(): void {
    setValues(initialValues(form));
    setTouched({});
    setSubmitted(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitted(true);
    if (!isValid) {
      toast({ kind: 'error', title: 'Revisa el formulario', description: 'Hay campos con errores.' });
      return;
    }

    const body = normalizeValues(form.fields, values);

    try {
      const response = await mutation.mutateAsync(body);
      const extra = formatOutputSummary(response.output);
      toast({
        kind: 'success',
        title: form.successMessage,
        description: extra ?? `Submission ${response.submissionId.slice(0, 8)} en ${response.durationMs} ms`,
        duration: 6000,
      });
      setLastSuccess(response);
      resetForm();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido';
      toast({
        kind: 'error',
        title: 'No se pudo enviar',
        description: message,
        duration: 8000,
      });
    }
  }

  return (
    <Card className="p-6 animate-fade-in-up">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {form.fields.map((f) => (
          <div key={f.name} onBlur={() => handleBlur(f.name)}>
            <Field
              field={f}
              value={values[f.name]}
              onChange={(v) => handleChange(f.name, v)}
              error={visibleErrors[f.name]}
              disabled={mutation.isPending}
            />
          </div>
        ))}

        <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-border">
          {lastSuccess ? (
            <div className="flex items-center gap-2 text-xs text-success mr-auto">
              <CheckCircle2 size={14} />
              Ultimo envio: {lastSuccess.submissionId.slice(0, 8)} · {lastSuccess.durationMs} ms
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={resetForm}
            disabled={mutation.isPending}
          >
            Limpiar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={Send}
            loading={mutation.isPending}
          >
            Enviar
          </Button>
        </div>
      </form>
    </Card>
  );
}
