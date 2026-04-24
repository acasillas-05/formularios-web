import { type FormDefinition } from '../../lib/formTypes.js';

export const registrarOperadorCliente: FormDefinition = {
  slug: 'registrar-operador-cliente',
  title: 'Registrar Operadores (Transportista Cliente)',
  subtitle: 'Registrar operadores de transporte del cliente.',
  baseRole: 'operativo',
  fields: [
    {
      name: 'NombreOperadorInput',
      label: 'Nombre del Operador',
      required: true,
      type: { kind: 'text', maxLength: 100, placeholder: 'Juan Perez Garcia' },
    },
    {
      name: 'NombreProveedor',
      label: 'Linea Transportista',
      required: true,
      type: { kind: 'searchable-select', source: 'proveedores-transportista-cliente' },
    },
  ],
  submit: {
    spName: 'sp_InsertarOperador',
    spInputs: [
      { source: 'field', fieldName: 'NombreProveedor', spParamName: 'NombreProveedor', spParamType: { kind: 'NVARCHAR', length: 100 } },
      { source: 'field', fieldName: 'NombreOperadorInput', spParamName: 'NombreOperadorInput', spParamType: { kind: 'NVARCHAR', length: 100 } },
      { source: 'constant', value: 'Transportista Cliente', spParamName: 'TipoProveedor', spParamType: { kind: 'NVARCHAR', length: 50 } },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'INT' } },
      { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
    ],
  },
  successMessage: 'Operador registrado correctamente.',
};
