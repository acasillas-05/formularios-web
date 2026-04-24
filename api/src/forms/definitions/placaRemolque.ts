import { type FormDefinition } from '../../lib/formTypes.js';

export const placaRemolque: FormDefinition = {
  slug: 'placa-remolque',
  title: 'Placa Remolque',
  subtitle: 'Registrar placas remolque en base de datos (solo ADN Transporte).',
  baseRole: 'operativo',
  fields: [
    {
      name: 'NumEconomicoInput',
      label: 'Numero Economico',
      required: false,
      description: 'Opcional. Si no tiene, dejalo vacio.',
      type: { kind: 'text', maxLength: 255, uppercase: true },
    },
    {
      name: 'PlacaInput',
      label: 'Placa Remolque (sin guiones)',
      required: true,
      type: { kind: 'text', maxLength: 255, uppercase: true, placeholder: 'ABC1234' },
    },
    {
      name: 'NombreProveedor',
      label: 'Linea Transportista',
      required: true,
      // El form original en Microsoft Forms solo listaba "ADN Transporte" — respetamos
      // la misma restriccion. Si en el futuro se amplian opciones, se cambia aqui.
      type: {
        kind: 'select',
        options: [{ value: 'ADN Transporte', label: 'ADN Transporte' }],
      },
    },
  ],
  submit: {
    spName: 'sp_RegistrarPlacaRemolque',
    spInputs: [
      { source: 'field', fieldName: 'NombreProveedor', spParamName: 'NombreProveedor', spParamType: { kind: 'NVARCHAR', length: 255 } },
      { source: 'field', fieldName: 'PlacaInput', spParamName: 'PlacaInput', spParamType: { kind: 'NVARCHAR', length: 255 } },
      { source: 'field', fieldName: 'NumEconomicoInput', spParamName: 'NumEconomicoInput', spParamType: { kind: 'NVARCHAR', length: 255 } },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'SMALLINT' } },
      { name: 'Error', type: { kind: 'VARCHAR', length: 500 } },
    ],
  },
  successMessage: 'Placa remolque registrada correctamente.',
};
