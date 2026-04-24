import { type FormDefinition } from '../../lib/formTypes.js';

export const eliminarSalidaTaraLrs: FormDefinition = {
  slug: 'eliminar-salida-tara-lrs',
  title: 'Eliminar Salida - Tara - LotesRealesSalida',
  subtitle: 'Elimina en cascada LotesRealesSalida, Salidas y la Tara asociada a la Entrega dada.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'Entrega',
      label: 'Entrega',
      required: true,
      type: { kind: 'number', integer: true, min: 1 },
    },
  ],
  submit: {
    spName: 'sp_DeleteTaraSalidaLRS',
    // sp_DeleteTaraSalidaLRS devuelve SELECT @Success, @Estatus
    resultsetConvention: true,
    spInputs: [
      {
        source: 'field',
        fieldName: 'Entrega',
        spParamName: 'Entrega',
        spParamType: { kind: 'BIGINT' },
      },
    ],
  },
  successMessage: 'Salida eliminada correctamente.',
};
