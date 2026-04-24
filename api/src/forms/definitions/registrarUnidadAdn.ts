import { type FormDefinition } from '../../lib/formTypes.js';

export const registrarUnidadAdn: FormDefinition = {
  slug: 'registrar-unidad-adn',
  title: 'Registrar Unidades (Transportista ADN)',
  subtitle: 'Registrar unidades de transporte propio.',
  baseRole: 'operativo',
  fields: [
    {
      name: 'NumEconomicoInput',
      label: 'Unidad / FZ',
      description: 'Numero Economico (S/N en caso de no tenerlo).',
      required: true,
      type: { kind: 'text', maxLength: 50, uppercase: true, placeholder: 'Ej. FZ-042 o S/N' },
    },
    {
      name: 'PlacaInput',
      label: 'Placa (sin guiones)',
      required: true,
      type: { kind: 'text', maxLength: 50, uppercase: true, placeholder: 'ABC1234' },
    },
    {
      name: 'NombreProveedor',
      label: 'Linea Transportista',
      required: true,
      type: { kind: 'searchable-select', source: 'proveedores-transportista' },
    },
  ],
  submit: {
    spName: 'sp_InsertarPlaca',
    spInputs: [
      { source: 'field', fieldName: 'NombreProveedor', spParamName: 'NombreProveedor', spParamType: { kind: 'NVARCHAR', length: 100 } },
      { source: 'field', fieldName: 'NumEconomicoInput', spParamName: 'NumEconomicoInput', spParamType: { kind: 'NVARCHAR', length: 50 } },
      { source: 'field', fieldName: 'PlacaInput', spParamName: 'PlacaInput', spParamType: { kind: 'NVARCHAR', length: 50 } },
      { source: 'constant', value: 'Transportista', spParamName: 'TipoProveedor', spParamType: { kind: 'NVARCHAR', length: 50 } },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'INT' } },
      { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
    ],
  },
  successMessage: 'Unidad registrada correctamente.',
};
