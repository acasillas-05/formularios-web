import { type FormDefinition } from '../../lib/formTypes.js';

export const permitirPesajeManual: FormDefinition = {
  slug: 'permitir-pesaje-manual',
  title: 'Permitir Pesaje Manual',
  subtitle: 'Activa o desactiva pesaje manual por centro.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'IDCentro',
      label: 'Centro',
      required: true,
      type: { kind: 'searchable-select', source: 'centros-pesaje' },
    },
    {
      name: 'AllowManual',
      label: 'Pesaje Manual',
      description: '0 = Apagado, 1 = Encendido.',
      required: true,
      type: {
        kind: 'radio',
        options: [
          { value: '1', label: 'Encendido' },
          { value: '0', label: 'Apagado' },
        ],
      },
    },
  ],
  submit: {
    spName: 'sp_UpdatePesajeManual',
    spInputs: [
      {
        source: 'field',
        fieldName: 'AllowManual',
        spParamName: 'AllowManual',
        spParamType: { kind: 'INT' },
      },
      {
        source: 'field',
        fieldName: 'IDCentro',
        spParamName: 'IDCentro',
        spParamType: { kind: 'BIGINT' },
      },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'SMALLINT' } },
      { name: 'Error', type: { kind: 'VARCHAR', length: 500 } },
    ],
  },
  successMessage: 'Configuracion de pesaje manual actualizada.',
};
