import CreateMessageService, { MessageData } from "../services/MessageServices/CreateMessageService";
import logger from "../utils/logger";
import Message from "../models/Message";

interface SafeCreateMessageParams {
  messageData: MessageData;
  companyId: number;
  maxRetries?: number;
  context?: string;
}

/**
 * Wrapper seguro para CreateMessageService com retry e fallback
 * Garante que mensagens não sejam perdidas em caso de falhas temporárias
 */
export const SafeCreateMessage = async ({
  messageData,
  companyId,
  maxRetries = 3,
  context = "UNKNOWN"
}: SafeCreateMessageParams): Promise<Message | null> => {
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[SAFE CREATE MESSAGE] ${context} - Tentativa ${attempt}/${maxRetries} - WID: ${messageData.wid}`);
      
      const message = await CreateMessageService({ messageData, companyId });
      
      logger.info(`[SAFE CREATE MESSAGE] ${context} - ✅ Mensagem salva com sucesso - WID: ${messageData.wid}`);
      return message;
      
    } catch (error: any) {
      lastError = error;
      logger.error(`[SAFE CREATE MESSAGE] ${context} - ❌ Tentativa ${attempt}/${maxRetries} falhou - WID: ${messageData.wid}`, error);
      
      // Se for erro de constraint (mensagem duplicada), não precisa retry
      if (error.name === 'SequelizeUniqueConstraintError' || 
          error.message?.includes('Validation error') ||
          error.message?.includes('duplicate key')) {
        logger.warn(`[SAFE CREATE MESSAGE] ${context} - ⚠️ Mensagem duplicada detectada - WID: ${messageData.wid}`);
        
        // Tentar buscar mensagem existente
        try {
          const existing = await Message.findOne({
            where: { wid: messageData.wid, companyId }
          });
          if (existing) {
            logger.info(`[SAFE CREATE MESSAGE] ${context} - ✅ Mensagem já existe no banco - WID: ${messageData.wid}`);
            return existing;
          }
        } catch (findError) {
          logger.error(`[SAFE CREATE MESSAGE] ${context} - ❌ Erro ao buscar mensagem existente`, findError);
        }
        
        break; // Não tentar novamente em caso de duplicata
      }
      
      // Aguardar antes de tentar novamente (backoff exponencial)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.info(`[SAFE CREATE MESSAGE] ${context} - ⏳ Aguardando ${delay}ms antes de retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  logger.error(`[SAFE CREATE MESSAGE] ${context} - 🚨 CRÍTICO: Mensagem NÃO foi salva após ${maxRetries} tentativas - WID: ${messageData.wid}`);
  logger.error(`[SAFE CREATE MESSAGE] ${context} - Último erro:`, lastError);
  
  // ✅ FALLBACK: Salvar em arquivo para recuperação manual
  try {
    const fs = require('fs');
    const path = require('path');
    const failedMessagesDir = path.join(__dirname, '../../failed_messages');
    
    if (!fs.existsSync(failedMessagesDir)) {
      fs.mkdirSync(failedMessagesDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${messageData.wid}_${context}.json`;
    const filepath = path.join(failedMessagesDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify({
      messageData,
      companyId,
      context,
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, null, 2));
    
    logger.warn(`[SAFE CREATE MESSAGE] ${context} - 💾 Mensagem salva em arquivo para recuperação: ${filepath}`);
  } catch (fileError) {
    logger.error(`[SAFE CREATE MESSAGE] ${context} - ❌ Erro ao salvar mensagem em arquivo:`, fileError);
  }
  
  return null;
};

export default SafeCreateMessage;
