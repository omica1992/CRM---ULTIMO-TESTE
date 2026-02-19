/**
 * Helper para normalização de números de telefone
 * Garante que números estejam no formato correto para WhatsApp API
 * 
 * CONTEXTO: Os números no banco de dados vêm de duas fontes:
 * 1. Meta Webhook API → sempre envia COM código do país (ex: 5511999887766)
 * 2. Criação manual → pode vir sem código do país (ex: 11999887766)
 * 
 * A API da Meta espera números SEM o "+" — apenas dígitos com código do país.
 */

import logger from "../utils/logger";

/**
 * Normaliza número de telefone para o formato aceito pela API do WhatsApp
 * 
 * @param number - Número do contato (pode vir com ou sem código do país)
 * @returns Número normalizado com código do país (sem "+")
 */
export const normalizePhoneNumber = (number: string): string => {
    if (!number) {
        throw new Error('Número de telefone não fornecido');
    }

    // Remove todos os caracteres não numéricos (incluindo +, -, espaços, parênteses)
    let cleanNumber = number.replace(/\D/g, '');

    // Se vazio após limpeza
    if (!cleanNumber) {
        throw new Error(`Número de telefone inválido após limpeza: "${number}"`);
    }

    logger.debug(`[PHONE NORMALIZE] Input: "${number}" -> Limpo: "${cleanNumber}" (${cleanNumber.length} dígitos)`);

    // ────────────────────────────────────────────────────────────────
    // NÚMEROS QUE JÁ TÊM CÓDIGO DO PAÍS (vindos do WhatsApp/Meta)
    // ────────────────────────────────────────────────────────────────

    // 13 dígitos começando com 55 → BR completo (55 + DDD 2d + celular 9d COM prefixo 9)
    // Ex: 5511999887766 (SP, celular com 9)
    if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
        return cleanNumber;
    }

    // 12 dígitos começando com 55 → BR completo (55 + DDD 2d + 8d SEM prefixo 9)
    // Pode ser fixo OU celular antigo sem o 9 — ambos são válidos
    // Ex: 551199887766 (SP, celular sem 9) ou 551133445566 (SP, fixo)
    // NÃO adicionar o 9 automaticamente — a API da Meta aceita ambos os formatos
    if (cleanNumber.length === 12 && cleanNumber.startsWith('55')) {
        return cleanNumber;
    }

    // 14+ dígitos → número internacional completo (ex: México 521..., Índia 91...)
    if (cleanNumber.length >= 14) {
        return cleanNumber;
    }

    // ────────────────────────────────────────────────────────────────
    // NÚMEROS SEM CÓDIGO DO PAÍS (criados manualmente)
    // ────────────────────────────────────────────────────────────────

    // 11 dígitos → BR sem código de país (DDD 2d + celular 9d)
    // Nota: DDDs 51-55 existem (RS, SC, PR, MG), então 55XXXXXXX é DDD válido
    if (cleanNumber.length === 11) {
        return `55${cleanNumber}`;
    }

    // 10 dígitos → BR sem código de país (DDD 2d + fixo 8d)
    if (cleanNumber.length === 10) {
        return `55${cleanNumber}`;
    }

    // ────────────────────────────────────────────────────────────────
    // OUTROS CASOS
    // ────────────────────────────────────────────────────────────────

    // 8-9 dígitos → número sem DDD/país — manter como está, provavelmente inválido
    // mas não modificar para não corromper o dado
    if (cleanNumber.length <= 9) {
        logger.warn(`[PHONE NORMALIZE] ⚠️ Número curto (${cleanNumber.length} dígitos): ${cleanNumber}`);
        return cleanNumber;
    }

    // Qualquer outro caso (ex: 11 dígitos de outro país) → manter como está
    logger.debug(`[PHONE NORMALIZE] Mantido: ${cleanNumber} (${cleanNumber.length} dígitos)`);
    return cleanNumber;
};

/**
 * Valida se o número está no formato aceitável para envio via WhatsApp API
 * 
 * Validação PERMISSIVA — melhor enviar e receber erro da Meta API
 * do que bloquear silenciosamente números válidos.
 * 
 * @param number - Número a ser validado (já normalizado, sem +)
 * @returns true se válido, false caso contrário
 */
export const isValidWhatsAppNumber = (number: string): boolean => {
    if (!number) return false;

    const cleanNumber = number.replace(/\D/g, '');

    // Números muito curtos (< 8 dígitos) são provavelmente inválidos
    if (cleanNumber.length < 8) {
        logger.warn(`[PHONE VALIDATE] ❌ Número muito curto (${cleanNumber.length} dígitos): ${cleanNumber}`);
        return false;
    }

    // Números muito longos (> 15 dígitos) são inválidos pelo padrão E.164
    if (cleanNumber.length > 15) {
        logger.warn(`[PHONE VALIDATE] ❌ Número muito longo (${cleanNumber.length} dígitos): ${cleanNumber}`);
        return false;
    }

    // Tudo entre 8 e 15 dígitos é potencialmente válido
    return true;
};

/**
 * Extrai informações do número brasileiro
 * 
 * @param number - Número brasileiro (com ou sem código de país)
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
