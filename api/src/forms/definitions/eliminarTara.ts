import { type FormDefinition } from '../../lib/formTypes.js';

export const eliminarTara: FormDefinition = {
  slug: 'eliminar-tara',
  title: 'Eliminar Tara',
  subtitle: 'Elimina un registro de la tabla Tara por FolioProcesoCarga.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'FolioProcesoCarga',
      label: 'Folio Proceso Carga',
      required: true,
      type: { kind: 'number', integer: true, min: 1 },
    },
  ],
  submit: {
    spName: 'sp_DeleteTara',
    // sp_DeleteTara devuelve SELECT @Success AS Success, @Estatus AS Estatus
    // (no usa OUTPUT params).
    resultsetConvention: true,
    spInputs: [
      {
        source: 'field',
        fieldName: 'FolioProcesoCarga',
        spParamName: 'FolioProcesoCarga',
        spParamType: { kind: 'BIGINT' },
      },
    ],
    // sin spOutputs: se interpreta el recordset
  },
  successMessage: 'Tara eliminada correctamente.',
};
