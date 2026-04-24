import { type FormDefinition } from '../../lib/formTypes.js';

export const registrarProveedor: FormDefinition = {
  slug: 'registrar-proveedor',
  title: 'Registrar Proveedor',
  subtitle: 'Registrar lineas transportistas y proveedores de materia prima.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'NombreProveedor',
      label: 'Nombre Proveedor',
      required: true,
      type: { kind: 'text', maxLength: 255 },
    },
    {
      name: 'TipoProveedor',
      label: 'Tipo Proveedor',
      required: true,
      type: {
        kind: 'radio',
        options: [
          { value: 'Transportista', label: 'Transportista' },
          { value: 'Transportista Cliente', label: 'Transportista Cliente' },
          { value: 'Materia Prima', label: 'Materia Prima' },
        ],
      },
    },
    {
      name: 'IDProveedor',
      label: 'ID Proveedor (SAP)',
      description:
        'Requerido para Transportista (rango 2000001-2999999) y Materia Prima (rango 1000001-1999999). Se deja vacio para Transportista Cliente (se asigna automatico).',
      required: false,
      type: { kind: 'number', integer: true, min: 1 },
    },
  ],
  submit: {
    spName: 'sp_InsertarProveedor',
    spInputs: [
      {
        source: 'field',
        fieldName: 'NombreProveedor',
        spParamName: 'NombreProveedor',
        spParamType: { kind: 'VARCHAR', length: 255 },
      },
      {
        source: 'field',
        fieldName: 'TipoProveedor',
        spParamName: 'TipoProveedor',
        spParamType: { kind: 'VARCHAR', length: 255 },
      },
      {
        source: 'field',
        fieldName: 'IDProveedor',
        spParamName: 'IDProveedor',
        spParamType: { kind: 'BIGINT' },
      },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'INT' } },
      { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
      // El SP devuelve el ID asignado; util para Transportista Cliente (se autogenera).
      { name: 'IDProveedorAsignado', type: { kind: 'BIGINT' } },
    ],
  },
  successMessage: 'Proveedor registrado correctamente.',
};
