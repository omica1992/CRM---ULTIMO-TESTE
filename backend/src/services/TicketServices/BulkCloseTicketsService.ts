import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "./UpdateTicketService";

interface Request {
    ticketIds: number[];
    companyId: number;
    userId: number; // ID do usuário que está fazendo a solicitação
}

interface BulkCloseResult {
    closedTickets: number[];
    failedTickets: Array<{
        ticketId: number;
        error: string;
    }>;
    totalTickets: number;
}

const BulkCloseTicketsService = async ({
    ticketIds,
    companyId,
    userId
}: Request): Promise<BulkCloseResult> => {
    const io = getIO();
    const closedTickets: number[] = [];
    const failedTickets: Array<{ ticketId: number; error: string }> = [];

    console.log(`[BULK CLOSE] Iniciando encerramento em massa para ${ticketIds.length} tickets`);

    // Validações iniciais
    if (!ticketIds || ticketIds.length === 0) {
        throw new Error("Lista de tickets não pode estar vazia");
    }

    // Buscar tickets válidos para encerramento
    const tickets = await Ticket.findAll({
        where: {
            id: ticketIds,
            companyId,
            status: ["open", "pending"] // Só permite encerrar tickets abertos ou pendentes
        }
    });

    if (tickets.length === 0) {
        console.log(`[BULK CLOSE] Nenhum ticket válido encontrado para encerramento`);

        // Marcar todos os tickets como falha
        const allFailures = ticketIds.map(ticketId => ({
            ticketId,
            error: "Ticket não encontrado ou já está fechado"
        }));

        return {
            closedTickets: [],
            failedTickets: allFailures,
            totalTickets: ticketIds.length
        };
    }

    // Processar cada ticket individualmente
    for (const ticket of tickets) {
        try {
            // Validar se ticket pertence à empresa correta
            if (ticket.companyId !== companyId) {
                failedTickets.push({
                    ticketId: ticket.id,
                    error: "Não é possível acessar registros de outra empresa"
                });
                continue;
            }

            // Preparar dados para encerramento
            // Seguindo a lógica do closeAll do TicketController e do frontend
            const ticketData = {
                status: "closed",
                userId: ticket.userId || userId, // Mantém o usuário atual ou atribui a quem está fechando
                queueId: ticket.queueId || null,
                unreadMessages: 0,
                amountUsedBotQueues: 0,
                sendFarewellMessage: false
            };

            await UpdateTicketService({
                ticketData,
                ticketId: ticket.id,
                companyId
            });

            closedTickets.push(ticket.id);

        } catch (error) {
            console.error(`[BULK CLOSE] ❌ Erro ao encerrar ticket ${ticket.id}:`, error);
            failedTickets.push({
                ticketId: ticket.id,
                error: error.message || "Erro interno ao encerrar ticket"
            });
        }
    }

    // Emitir evento geral de atualização
    io.of(String(companyId)).emit(`company-${companyId}-bulk-close`, {
        action: "completed",
        closedTickets: closedTickets.length,
        failedTickets: failedTickets.length,
        totalTickets: ticketIds.length
    });

    return {
        closedTickets,
        failedTickets,
        totalTickets: ticketIds.length
    };
};

export default BulkCloseTicketsService;
