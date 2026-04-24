import { type FormDefinition } from '../../lib/formTypes.js';

export const eliminarEntradaLre: FormDefinition = {
  slug: 'eliminar-entrada-lre',
  title: 'Eliminar Entrada LRE',
  subtitle: 'Elimina Entradas y LotesRealesEntrada.',
  baseRole: 'jefe_de_patio',
  fields: [
    {
      name: 'TipoEntrada',
      label: 'Tipo de Entrada',
      required: true,
      type: {
        kind: 'radio',
        options: [
          { value: 'Compra', label: 'Compra' },
          { value: 'Traspaso', label: 'Traspaso' },
        ],
      },
    },
    {
      name: 'EntregaOC',
      label: 'Entrega / Orden de Compra',
      required: true,
      type: { kind: 'number', integer: true, min: 1 },
    },
    {
      name: 'DocumentoMaterial',
      label: 'Documento Material',
      description: 'Opcional. Usa -1 como comodin si la entrega tiene varios documentos.',
      required: false,
      type: { kind: 'number', integer: true, allowNegative: true },
    },
    {
      name: 'IDEntrada',
      label: 'ID Entrada',
      description: 'Opcional. Requerido para Traspaso cuando no hay Documento Material.',
      required: false,
      type: { kind: 'number', integer: true, min: 1 },
    },
  ],
  submit: {
    spName: 'sp_DeleteEntradaLRE',
    spInputs: [
      {
        source: 'field',
        fieldName: 'DocumentoMaterial',
        spParamName: 'DocumentoMaterial',
        spParamType: { kind: 'BIGINT' },
      },
      {
        source: 'field',
        fieldName: 'EntregaOC',
        spParamName: 'EntregaOC',
        spParamType: { kind: 'BIGINT' },
      },
      {
        source: 'field',
        fieldName: 'IDEntrada',
        spParamName: 'IDEntrada',
        spParamType: { kind: 'BIGINT' },
      },
      {
        source: 'field',
        fieldName: 'TipoEntrada',
        spParamName: 'TipoEntrada',
        spParamType: { kind: 'VARCHAR', length: 255 },
      },
    ],
    spOutputs: [
      { name: 'Status', type: { kind: 'INT' } },
      { name: 'Error', type: { kind: 'NVARCHAR', length: 'MAX' } },
    ],
  },
  successMessage: 'Entrada eliminada correctamente.',
};
