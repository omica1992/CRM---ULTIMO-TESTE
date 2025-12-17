/**
 * Baileys 7.x LID (Local Identifier) Helper Functions
 * 
 * WhatsApp agora usa LIDs além de Phone Numbers (PN) para identificar usuários.
 * Este helper fornece funções para trabalhar com ambos os formatos.
 * 
 * Formatos:
 * - PN (Phone Number): 5511999999999@s.whatsapp.net
 * - LID (Local Identifier): 28798376505512@lid
 * 
 * Referência: https://whiskey.so/migrate-latest
 */

/**
 * Verifica se um JID é um Phone Number (formato antigo)
 * @param jid - JID para verificar
 * @returns true se for um PN
 */
export const isPnUser = (jid: string | null | undefined): boolean => {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net');
};

/**
 * Verifica se um JID é um LID (Local Identifier)
 * @param jid - JID para verificar
 * @returns true se for um LID
 */
export const isLidUser = (jid: string | null | undefined): boolean => {
  if (!jid) return false;
  return jid.endsWith('@lid');
};

/**
 * Verifica se um JID é de um usuário (PN ou LID)
 * Substitui a antiga função isJidUser() do Baileys 6.x
 * @param jid - JID para verificar
 * @returns true se for usuário (PN ou LID)
 */
export const isJidUser = (jid: string | null | undefined): boolean => {
  return isPnUser(jid) || isLidUser(jid);
};

/**
 * Extrai o número de telefone de um JID (PN ou LID)
 * @param jid - JID para extrair
 * @returns número sem formatação
 */
export const extractNumberFromJid = (jid: string | null | undefined): string => {
  if (!jid) return '';
  
  // Remove @s.whatsapp.net ou @lid
  const cleaned = jid.split('@')[0];
  
  // Remove caracteres não numéricos
  return cleaned.replace(/\D/g, '');
};

/**
 * Normaliza um JID para o formato preferido
 * Se tiver remoteJidAlt, usa ele (geralmente é o PN quando remoteJid é LID)
 * @param remoteJid - JID principal
 * @param remoteJidAlt - JID alternativo (opcional)
 * @returns JID normalizado
 */
export const normalizeJid = (
  remoteJid: string | null | undefined,
  remoteJidAlt?: string | null | undefined
): string => {
  // Priorizar PN se disponível
  if (remoteJidAlt && isPnUser(remoteJidAlt)) {
    return remoteJidAlt;
  }
  
  // Se remoteJid é PN, usar ele
  if (isPnUser(remoteJid)) {
    return remoteJid || '';
  }
  
  // Se remoteJid é LID, usar ele (não temos alternativa)
  if (isLidUser(remoteJid)) {
    return remoteJid || '';
  }
  
  // Fallback
  return remoteJid || '';
};

/**
 * Obtém informações sobre um JID
 * @param jid - JID para analisar
 * @returns objeto com informações
 */
export const getJidInfo = (jid: string | null | undefined) => {
  return {
    jid: jid || '',
    isPn: isPnUser(jid),
    isLid: isLidUser(jid),
    isUser: isJidUser(jid),
    number: extractNumberFromJid(jid),
    type: isPnUser(jid) ? 'pn' : isLidUser(jid) ? 'lid' : 'unknown'
  };
};

/**
 * Cria um mapeamento de LID <-> PN para cache
 * Útil para manter referência entre os dois formatos
 */
export class LidPnMapping {
  private lidToPn: Map<string, string> = new Map();
  private pnToLid: Map<string, string> = new Map();

  /**
   * Armazena um mapeamento LID <-> PN
   */
  store(lid: string, pn: string): void {
    if (isLidUser(lid) && isPnUser(pn)) {
      this.lidToPn.set(lid, pn);
      this.pnToLid.set(pn, lid);
    }
  }

  /**
   * Obtém o PN a partir de um LID
   */
  getPnForLid(lid: string): string | undefined {
    return this.lidToPn.get(lid);
  }

  /**
   * Obtém o LID a partir de um PN
   */
  getLidForPn(pn: string): string | undefined {
    return this.pnToLid.get(pn);
  }

  /**
   * Verifica se tem mapeamento para um JID
   */
  has(jid: string): boolean {
    return this.lidToPn.has(jid) || this.pnToLid.has(jid);
  }

  /**
   * Obtém o JID alternativo (se LID retorna PN, se PN retorna LID)
   */
  getAlternative(jid: string): string | undefined {
    if (isLidUser(jid)) {
      return this.getPnForLid(jid);
    } else if (isPnUser(jid)) {
      return this.getLidForPn(jid);
    }
    return undefined;
  }

  /**
   * Limpa o cache
   */
  clear(): void {
    this.lidToPn.clear();
    this.pnToLid.clear();
  }

  /**
   * Retorna o tamanho do cache
   */
  size(): number {
    return this.lidToPn.size;
  }
}

// Instância global do mapeamento (pode ser usada em todo o projeto)
export const globalLidPnMapping = new LidPnMapping();

/**
 * Log helper para debug de LIDs
 */
export const logJidInfo = (prefix: string, jid: string | null | undefined, alt?: string | null | undefined): void => {
  const info = getJidInfo(jid);
  const altInfo = alt ? getJidInfo(alt) : null;
  
  console.log(`[${prefix}] JID Info:`, {
    main: info,
    alt: altInfo,
    normalized: normalizeJid(jid, alt)
  });
};
