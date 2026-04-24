import { type FormDefinition } from '../../lib/formTypes.js';

export const habilitarConcatRem: FormDefinition = {
  slug: 'habilitar-concat-rem',
  title: 'Habilitar Concatenado Remision Externa',
  subtitle: 'Habilita que a SAP se le mande la remision externa concatenada al nombre del operador.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'CentroDestino',
      label: 'Centro - Destino',
      description: 'Se muestra como "IDCentro - Destino".',
      required: true,
      type: { kind: 'searchable-select', source: 'centro-destino' },
    },
    {
      name: 'Estatus',
      label: 'Estatus',
      required: true,
      type: {
        kind: 'radio',
        options: [
          { value: 'Habilitado', label: 'Habilitado' },
          { value: 'Deshabilitado', label: 'Deshabilitado' },
        ],
      },
    },
  ],
  submit: {
    spName: 'sp_ActualizarConcatRemisionExt',
    spInputs: [
      {
        source: 'field',
        fieldName: 'CentroDestino',
        spParamName: 'CentroDestino',
        spParamType: { kind: 'VARCHAR', length: 200 },
      },
      {
        source: 'field',
        fieldName: 'Estatus',
        spParamName: 'Estatus',
        spParamType: { kind: 'VARCHAR', length: 15 },
      },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'INT' } },
      { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
    ],
  },
  successMessage: 'Estatus de concatenado actualizado correctamente.',
};
