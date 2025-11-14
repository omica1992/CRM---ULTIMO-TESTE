import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";

interface Check24hResult {
  isOficial: boolean;
  isWithin24h: boolean;
  hoursSinceLastMessage: number | null;
  hasClientMessages: boolean;
}

/**
 * Verifica se o ticket está dentro da janela de 24h para envio de mensagens na API Oficial
 * 
 * Regra da API Oficial do WhatsApp:
 * - Só pode enviar mensagens normais dentro de 24h após a última mensagem do cliente
 * - Após 24h, só pode enviar templates aprovados
 * - Se o cliente nunca enviou mensagem, só pode enviar templates
 */
const CheckApiOficial24hWindow = async (ticket: Ticket): Promise<Check24hResult> => {
  // ✅ SEMPRE carregar whatsapp do banco para garantir dados corretos
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  
  if (!whatsapp) {
    console.log(`[24H CHECK] ❌ Ticket ${ticket.id} - WhatsApp ${ticket.whatsappId} não encontrado`);
    return {
      isOficial: false,
      isWithin24h: false,
      hoursSinceLastMessage: null,
      hasClientMessages: false
    };
  }

  // Verificar se é API Oficial
  console.log(`[24H CHECK] Ticket ${ticket.id} - WhatsApp ${whatsapp.id}: Provider="${whatsapp.provider}", Channel="${whatsapp.channel}"`);
  
  const isOficial = whatsapp.provider === "oficial" || 
                   
                   whatsapp.channel === "whatsapp-oficial" || 
                   whatsapp.channel === "whatsapp_oficial";

  console.log(`[24H CHECK] Ticket ${ticket.id} - IsOficial: ${isOficial}`);

  if (!isOficial) {
    return {
      isOficial: false,
      isWithin24h: true, // Baileys não tem restrição de 24h
      hoursSinceLastMessage: null,
      hasClientMessages: true
    };
  }

  // Buscar última mensagem do cliente (fromMe = false)
  const lastClientMessage = await Message.findOne({
    where: {
      ticketId: ticket.id,
      fromMe: false
    },
    order: [["createdAt", "DESC"]]
  });

  if (!lastClientMessage) {
    // Sem mensagens do cliente
    return {
      isOficial: true,
      isWithin24h: false,
      hoursSinceLastMessage: null,
      hasClientMessages: false
    };
  }

  // Calcular tempo desde última mensagem
  const now = new Date();
  const lastMessageTime = new Date(lastClientMessage.createdAt);
  const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);
  const isWithin24h = hoursSinceLastMessage <= 24;

  return {
    isOficial: true,
    isWithin24h,
    hoursSinceLastMessage,
    hasClientMessages: true
  };
};

export default CheckApiOficial24hWindow;
