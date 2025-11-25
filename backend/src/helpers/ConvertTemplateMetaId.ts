// Helper para converter templateMetaId entre string e number

/**
 * Converte uma string para número se possível
 * @param value Valor a ser convertido
 * @returns Número convertido ou null
 */
export const toNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  
  const number = parseInt(value, 10);
  return isNaN(number) ? null : number;
};

/**
 * Converte um número para string
 * @param value Valor a ser convertido
 * @returns String convertida ou null
 */
export const toString = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  return value.toString();
};
