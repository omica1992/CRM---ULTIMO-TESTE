import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import AppError from "../../errors/AppError";

interface ICheckContactResponse {
  jid: string;
  exists: boolean;
  lid: string | null;
  error?: string;
}

/**
 * Valida um número de contato contra a API Oficial do WhatsApp
 * @param number - Número do contato (apenas dígitos)
 * @param whatsappConnection - Conexão WhatsApp Oficial
 * @returns Informações do contato validado
 */
export const CheckContactNumberOficial = async (
  number: string,
  whatsappConnection: Whatsapp
): Promise<ICheckContactResponse> => {
  try {
    // Formatar número para o padrão internacional
    const cleanNumber = number.replace(/\D/g, "");
    
    if (!cleanNumber || cleanNumber.length < 10) {
      logger.warn(`[CheckContactNumberOficial] Número inválido: ${number}`);
      throw new AppError("ERR_INVALID_PHONE_NUMBER", 400);
    }

    // Formatar como JID padrão do WhatsApp
    const jid = `${cleanNumber}@s.whatsapp.net`;

    // ✅ TODO: Implementar chamada real à API Oficial do WhatsApp para validar
    // Por enquanto, retorna com validação mínima
    // Quando implementado, isso deve chamar o endpoint:
    // POST /v1/contacts/check-exists ou similar
    
    logger.info(`[CheckContactNumberOficial] Validando número via API Oficial: ${cleanNumber}`);

    // Resposta temporária - substituir pela chamada real à API
    return {
      jid,
      exists: true, // TODO: Obter do endpoint real da API
      lid: null,
      error: undefined
    };
  } catch (error) {
    logger.error(`[CheckContactNumberOficial] Erro ao validar contato: ${error.message}`);
    
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `ERR_CHECK_CONTACT_OFICIAL: ${error.message}`,
      400
    );
  }
};

export default CheckContactNumberOficial;
