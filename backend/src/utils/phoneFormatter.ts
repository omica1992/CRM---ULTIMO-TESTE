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

    // ✅ CORREÇÃO: Verificar se já está no formato correto com código do país
    if (cleaned.startsWith('55')) {
      // 13 dígitos: 55 + DDD (2) + celular (9) = válido
      if (cleaned.length === 13) {
        console.log(`[phoneFormatter] Número válido com 13 dígitos (celular): ${cleaned}`);
        return cleaned;
      }

      // 12 dígitos: 55 + DDD (2) + fixo (8) = válido
      if (cleaned.length === 12) {
        console.log(`[phoneFormatter] Número válido com 12 dígitos (fixo): ${cleaned}`);
        return cleaned;
      }

      // Se tem mais de 13 dígitos, pode ter "55" duplicado
      if (cleaned.length > 13) {
        console.log(`[phoneFormatter] Número muito longo (${cleaned.length} dígitos), removendo "55" duplicado`);
        cleaned = cleaned.substring(2);
      }

      // Se tem 11 dígitos após remover "55", é número sem código do país
      if (cleaned.length === 11) {
        const formatted = '55' + cleaned;
        console.log(`[phoneFormatter] Adicionado código do país: ${formatted}`);
        return formatted;
      }
    }

    // Remove "0" no início se houver (código nacional)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
      console.log(`[phoneFormatter] Removido "0" inicial: ${cleaned}`);
    }

    // Se tem 11 dígitos (DDD + número), adiciona código do país
    if (cleaned.length === 11) {
      const formatted = '55' + cleaned;
      console.log(`[phoneFormatter] Número com 11 dígitos, adicionado código do país: ${formatted}`);
      return formatted;
    }

    // Se tem 10 dígitos (DDD + fixo antigo), adiciona código do país
    if (cleaned.length === 10) {
      const formatted = '55' + cleaned;
      console.log(`[phoneFormatter] Número com 10 dígitos (fixo), adicionado código do país: ${formatted}`);
      return formatted;
    }

    // Se chegou aqui, número inválido
    throw new Error(`Número com formato inválido: ${cleaned} (${cleaned.length} dígitos)`);
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
