/**
 * Helper para normalização de números de telefone
 * Garante que números brasileiros estejam no formato correto para WhatsApp API
 */

/**
 * Normaliza número de telefone para o formato aceito pela API do WhatsApp
 * 
 * Formato esperado pela API: +[código_país][DDD][número]
 * Exemplo: +5511991234567 (Brasil, SP, celular)
 * 
 * @param number - Número do contato (pode vir com ou sem código do país)
 * @returns Número normalizado no formato +[código_país][DDD][número]
 */
export const normalizePhoneNumber = (number: string): string => {
    if (!number) {
        throw new Error('Número de telefone não fornecido');
    }

    // Remove todos os caracteres não numéricos
    let cleanNumber = number.replace(/\D/g, '');

    // Se o número já começa com código do país (55 para Brasil)
    if (cleanNumber.startsWith('55')) {
        // Verifica se tem o tamanho correto: 55 + DDD (2 dígitos) + número (9 dígitos) = 13 dígitos
        if (cleanNumber.length === 13) {
            return `+${cleanNumber}`;
        }

        // Se tem 12 dígitos, pode ser número antigo sem o 9 adicional
        if (cleanNumber.length === 12) {
            return `+${cleanNumber}`;
        }

        // Se tem 11 dígitos, falta o código do país
        if (cleanNumber.length === 11) {
            return `+55${cleanNumber}`;
        }
    }

    // Se não começa com 55, assume que é número brasileiro sem código do país
    // Formato esperado: DDD (2 dígitos) + número (9 dígitos) = 11 dígitos
    if (cleanNumber.length === 11) {
        return `+55${cleanNumber}`;
    }

    // Se tem 10 dígitos, é número antigo sem o 9 adicional
    if (cleanNumber.length === 10) {
        return `+55${cleanNumber}`;
    }

    // Se chegou aqui, retorna com + na frente (pode ser número internacional)
    return `+${cleanNumber}`;
};

/**
 * Valida se o número está no formato correto para WhatsApp
 * 
 * @param number - Número a ser validado
 * @returns true se válido, false caso contrário
 */
export const isValidWhatsAppNumber = (number: string): boolean => {
    if (!number) return false;

    const cleanNumber = number.replace(/\D/g, '');

    // Número brasileiro deve ter 13 dígitos (55 + DDD + 9 dígitos) ou 12 (número antigo)
    if (cleanNumber.startsWith('55')) {
        return cleanNumber.length === 12 || cleanNumber.length === 13;
    }

    // Para outros países, aceita números com 10 a 15 dígitos
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
};

/**
 * Extrai informações do número brasileiro
 * 
 * @param number - Número brasileiro
 * @returns Objeto com código do país, DDD e número
 */
export const parsePhoneNumber = (number: string): { countryCode: string; areaCode: string; phoneNumber: string } | null => {
    const cleanNumber = number.replace(/\D/g, '');

    if (cleanNumber.startsWith('55') && (cleanNumber.length === 12 || cleanNumber.length === 13)) {
        return {
            countryCode: '55',
            areaCode: cleanNumber.substring(2, 4),
            phoneNumber: cleanNumber.substring(4)
        };
    }

    return null;
};
