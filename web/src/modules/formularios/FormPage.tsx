import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { ApiError } from '../../api/client';
import { useFormDefinition } from '../../api/forms';
import { FormRenderer } from '../../components/forms/FormRenderer';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { isFormSlugLike } from '../../lib/isFormSlug';
import type { FormSlug } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';

export function FormPage() {
  const { slug = '' } = useParams();
  const forms = useAuthStore((s) => s.forms);

  if (!isFormSlugLike(slug)) {
    return <FormError title="Ruta invalida" message={`"${slug}" no es un formulario conocido.`} />;
  }
  const access = forms.find((f) => f.slug === slug);
  if (!access) {
    return (
      <FormError
        title="Acceso denegado"
        message="No tienes permiso para este formulario. Si crees que es un error, contacta al administrador."
      />
    );
  }

  return <FormPageLoaded slug={slug} />;
}

function FormPageLoaded({ slug }: { slug: FormSlug }) {
  const query = useFormDefinition(slug);

  if (query.isPending) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : query.error instanceof Error
          ? query.error.message
          : 'Error desconocido';
    return <FormError title="No se pudo cargar el formulario" message={message} />;
  }

  const form = query.data;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link
        to="/formularios"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Formularios
      </Link>
      <h1 className="text-2xl font-bold text-text">{form.title}</h1>
      <p className="text-sm text-muted mt-1 mb-6">{form.subtitle}</p>
      <FormRenderer form={form} />
    </div>
  );
}

function FormError({ title, message }: { title: string; message: string }) {
  return (
    <div className="max-w-xl mx-auto animate-fade-in-up">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold text-danger mb-2">{title}</h1>
        <p className="text-sm text-muted mb-4">{message}</p>
        <Link to="/formularios" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft size={14} /> Volver al listado
        </Link>
      </Card>
    </div>
  );
}
