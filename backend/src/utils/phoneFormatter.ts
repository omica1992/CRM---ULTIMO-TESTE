/**
 * Formata número de telefone para padrão internacional
 * Remove espaços e caracteres especiais, adiciona prefixo 55 (Brasil) se necessário
 * 
 * ESTRATÉGIA SIMPLES:
 * 1. Remove todos os caracteres não-numéricos
 * 2. Remove prefixo "55" ou "0" se existir
 * 3. Pega apenas os últimos 11 dígitos (celular: DDD + 9 + 8 dígitos)
 * 4. Se ficar com menos de 10, rejeita
 * 5. Adiciona prefixo 55
 * 
 * @param number - Número em qualquer formato (string ou number)
 * @returns Número formatado como "5511987654321"
 * @throws Error se inválido
 */
export function formatPhoneNumber(number: string | number): string {
  try {
    if (!number && number !== 0) {
      throw new Error('Número vazio ou inválido');
    }

    // Converter para string se for número
    const numberStr = String(number).trim();

    if (!numberStr) {
      throw new Error('Número vazio ou inválido');
    }

    // Remove tudo que não é número
    let cleaned = numberStr.replace(/\D/g, '');

    if (!cleaned) {
      throw new Error('Nenhum dígito encontrado');
    }

    console.log(`[phoneFormatter] Input: ${number} → Limpo: ${cleaned}`);

    // Remove prefixo 55 se começa com ele (pode estar duplicado)
    while (cleaned.startsWith('55') && cleaned.length > 11) {
      console.log(`[phoneFormatter] Removendo "55" duplicado: ${cleaned}`);
      cleaned = cleaned.substring(2);
    }

    // Remove "0" no início se houver (código nacional)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
      console.log(`[phoneFormatter] Removido "0" inicial: ${cleaned}`);
    }

    // Se ainda tiver mais de 11 dígitos, pega apenas os últimos 11
    if (cleaned.length > 11) {
      const original = cleaned;
      cleaned = cleaned.slice(-11);
      console.log(`[phoneFormatter] Truncado de ${original.length} para 11: ${original} → ${cleaned}`);
    }

    // Validar: deve ter entre 10 e 11 dígitos
    if (cleaned.length < 10) {
      throw new Error(`Número muito curto: ${cleaned} (${cleaned.length} dígitos)`);
    }

    if (cleaned.length > 11) {
      throw new Error(`Número muito longo: ${cleaned} (${cleaned.length} dígitos)`);
    }

    // Adicionar prefixo 55
    const formatted = '55' + cleaned;
    console.log(`[phoneFormatter] Resultado final: ${formatted}`);

    return formatted;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[phoneFormatter] ERRO: ${msg} | Input original: ${number}`);
    throw new Error(`Número inválido: ${number} - ${msg}`);
  }
}

/**
 * Tenta formatar, retorna null se falhar
 */
export function tryFormatPhoneNumber(number: string | number): string | null {
  try {
    return formatPhoneNumber(number);
  } catch {
    return null;
  }
}
