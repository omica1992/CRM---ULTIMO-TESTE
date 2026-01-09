import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "./UpdateTicketService";
import ShowCompanyService from "../CompanyService/ShowCompanyService";
import ShowUserService from "../UserServices/ShowUserService";
import ShowQueueService from "../QueueService/ShowQueueService";

interface Request {
  ticketIds: number[];
  userId?: number;
  queueId?: number;
  transferMessage?: string;
  companyId: number;
  userRequestId: number; // ID do usuário que está fazendo a transferência
  openPendingTickets?: boolean; // Se deve abrir tickets pendentes durante a transferência
}

interface BulkTransferResult {
  successfulTransfers: number[];
  failedTransfers: Array<{
    ticketId: number;
    error: string;
  }>;
  totalTickets: number;
}

const BulkTransferTicketsService = async ({
  ticketIds,
  userId,
  queueId,
  transferMessage,
  companyId,
  userRequestId,
  openPendingTickets = false
}: Request): Promise<BulkTransferResult> => {
  const io = getIO();
  const successfulTransfers: number[] = [];
  const failedTransfers: Array<{ ticketId: number; error: string }> = [];

  console.log(`[BULK TRANSFER] Iniciando transferência múltipla para ${ticketIds.length} tickets`);
  console.log(`[BULK TRANSFER] Destino - UserId: ${userId}, QueueId: ${queueId}`);

  // Validações iniciais
  if (!ticketIds || ticketIds.length === 0) {
    throw new Error("Lista de tickets não pode estar vazia");
  }

  if (!userId && !queueId) {
    throw new Error("Deve especificar pelo menos um usuário ou fila de destino");
  }

  // Validar se usuário/fila existem
  if (userId) {
    try {
      await ShowUserService(userId, companyId);
    } catch (error) {
      throw new Error("Usuário de destino não encontrado");
    }
  }

  if (queueId) {
    try {
      await ShowQueueService(queueId, companyId);
    } catch (error) {
      throw new Error("Fila de destino não encontrada");
    }
  }

  // Buscar tickets válidos para transferência
  const tickets = await Ticket.findAll({
    where: {
      id: ticketIds,
      companyId,
      status: ["open", "pending"] // Só permite transferir tickets abertos ou pendentes
    },
    include: [
      {
        association: "whatsapp",
        attributes: ["id", "name", "status"]
      }
    ]
  });

  if (tickets.length === 0) {
    console.log(`[BULK TRANSFER] Nenhum ticket válido encontrado para transferência`);
    
    // Marcar todos os tickets como falha em vez de lançar exceção
    const allFailures = ticketIds.map(ticketId => ({
      ticketId,
      error: "Ticket não encontrado ou não está em status válido para transferência"
    }));

    return {
      successfulTransfers: [],
      failedTransfers: allFailures,
      totalTickets: ticketIds.length
    };
  }

  console.log(`[BULK TRANSFER] Encontrados ${tickets.length} tickets válidos de ${ticketIds.length} solicitados`);

  // Processar cada ticket individualmente
  for (const ticket of tickets) {
    try {
      console.log(`[BULK TRANSFER] Processando ticket ${ticket.id}`);

      // Validar se ticket pertence à empresa correta
      if (ticket.companyId !== companyId) {
        console.log(`[BULK TRANSFER] Ticket ${ticket.id} não pertence à empresa ${companyId}`);
        failedTransfers.push({
          ticketId: ticket.id,
          error: "Não é possível acessar registros de outra empresa"
        });
        continue;
      }

      // Validar se whatsapp existe e é válido
      if (!ticket.whatsappId || !ticket.whatsapp) {
        console.log(`[BULK TRANSFER] Ticket ${ticket.id} não tem whatsapp válido`);
        failedTransfers.push({
          ticketId: ticket.id,
          error: "Ticket não possui conexão WhatsApp válida"
        });
        continue;
      }

      // Verificar se o ticket já está no destino especificado
      if (userId && ticket.userId === userId && queueId && ticket.queueId === queueId) {
        console.log(`[BULK TRANSFER] Ticket ${ticket.id} já está no destino especificado`);
        failedTransfers.push({
          ticketId: ticket.id,
          error: "Ticket já está no destino especificado"
        });
        continue;
      }

      if (userId && !queueId && ticket.userId === userId) {
        console.log(`[BULK TRANSFER] Ticket ${ticket.id} já está atribuído ao usuário especificado`);
        failedTransfers.push({
          ticketId: ticket.id,
          error: "Ticket já está atribuído ao usuário especificado"
        });
        continue;
      }

      if (!userId && queueId && ticket.queueId === queueId) {
        console.log(`[BULK TRANSFER] Ticket ${ticket.id} já está na fila especificada`);
        failedTransfers.push({
          ticketId: ticket.id,
          error: "Ticket já está na fila especificada"
        });
        continue;
      }

      // Realizar a transferência usando o serviço existente
      const updateData: any = {
        isTransfered: true
      };

      if (userId) {
        updateData.userId = userId;
        // ✅ CORREÇÃO: Definir status como "open" quando transferido para um atendente
        // Isso remove da fila de "aguardando"
        updateData.status = "open";
        console.log(`[BULK TRANSFER] Alterando status do ticket ${ticket.id} para "open" por ser transferido para usuário`);
      } else if (openPendingTickets && ticket.status === "pending") {
        // ✅ NOVO: Abrir tickets pendentes se checkbox marcada (mesmo sem usuário específico)
        updateData.status = "open";
        console.log(`[BULK TRANSFER] Alterando status do ticket ${ticket.id} de "pending" para "open" (openPendingTickets=true)`);
      }

      if (queueId) {
        updateData.queueId = queueId;
      }

      if (transferMessage) {
        updateData.msgTransfer = transferMessage;
      }

      const result = await UpdateTicketService({
        ticketData: updateData,
        ticketId: ticket.id,
        companyId,
        isBulkTransfer: true // ✅ Flag para indicar transferência em massa
      });

      successfulTransfers.push(ticket.id);
      console.log(`[BULK TRANSFER] ✅ Ticket ${ticket.id} transferido com sucesso`);

    } catch (error) {
      console.error(`[BULK TRANSFER] ❌ Erro ao transferir ticket ${ticket.id}:`, error);
      failedTransfers.push({
        ticketId: ticket.id,
        error: error.message || "Erro interno na transferência"
      });
    }
  }

  // Emitir evento geral de atualização
  io.of(String(companyId)).emit(`company-${companyId}-bulk-transfer`, {
    action: "completed",
    successfulTransfers: successfulTransfers.length,
    failedTransfers: failedTransfers.length,
    totalTickets: ticketIds.length
  });

  console.log(`[BULK TRANSFER] Concluído - Sucessos: ${successfulTransfers.length}, Falhas: ${failedTransfers.length}`);

  return {
    successfulTransfers,
    failedTransfers,
    totalTickets: ticketIds.length
  };
};

export default BulkTransferTicketsService;
