import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import { instrument } from "@socket.io/admin-ui";
import User from "../models/User";
import { ReceibedWhatsAppService } from "../services/WhatsAppOficial/ReceivedWhatsApp";
import { JwtPayload, verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import BirthdayService from "../services/BirthdayService/BirthdayService";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL
    },
    // ✅ CORREÇÃO: Aumentar limite de tamanho de mensagem para suportar arquivos grandes
    // Padrão é 1MB, mas PDFs de 1MB viram ~1.3MB em base64
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB
    pingTimeout: 60000, // 60 segundos
    pingInterval: 25000  // 25 segundos
  });

  if (process.env.SOCKET_ADMIN && JSON.parse(process.env.SOCKET_ADMIN)) {
    User.findByPk(1).then(
      (adminUser) => {
        if (adminUser) {
          instrument(io, {
            auth: {
              type: "basic",
              username: adminUser.email,
              password: adminUser.passwordHash
            },
            mode: "development",
          });
        } else {
          logger.warn("Admin user with ID 1 not found for Socket.IO admin interface");
        }
      }
    ).catch((error) => {
      logger.error("Error finding admin user for Socket.IO admin interface:", error);
    });
  }

  const workspaces = io.of(/^\/\w+$/);
  workspaces.on("connection", socket => {

    const token_api_oficial = process.env.TOKEN_API_OFICIAL || "";
    const token = Array.isArray(socket?.handshake?.query?.token) ? socket.handshake.query.token[1] : socket?.handshake?.query?.token?.split(" ")[1];

    if (!token) {
      return socket.disconnect();
    }

    if (token !== token_api_oficial) {
      try {
        const decoded = verify(token, authConfig.secret);
        const companyId = socket.nsp.name.split("/")[1]

        const decodedPayload = decoded as JwtPayload;
        const companyIdToken = decodedPayload.companyId;

        if (+companyIdToken !== +companyId) {
          logger.error(`CompanyId do token ${companyIdToken} diferente da companyId do socket ${companyId}`)
          return socket.disconnect();
        }
      } catch (error) {
        logger.error(JSON.stringify(error), "Error decoding token");
        if (error.message !== "jwt expired") {
          return socket.disconnect();
        }
      }
    } else {
      logger.info(`Client connected namespace ${socket.nsp.name}`);
      logger.info(`Conectado com sucesso na API OFICIAL`);
    }

    //  ADICIONAR: Eventos de heartbeat e gerenciamento de usuários
    const handleHeartbeat = async (socket: any) => {
      try {
        const companyId = socket.nsp.name.split("/")[1];
        const decoded = verify(token !== token_api_oficial ? token : "", authConfig.secret);
        const decodedPayload = decoded as JwtPayload;
        const userId = decodedPayload.id;

        await User.update(
          {
            online: true,
            lastSeen: new Date()
          },
          { where: { id: userId } }
        );

        socket.broadcast.to(`company-${companyId}`).emit("user:online", {
          userId,
          lastSeen: new Date()
        });

        clearTimeout(socket.heartbeatTimeout);
        socket.heartbeatTimeout = setTimeout(async () => {
          await User.update(
            {
              online: false,
              lastSeen: new Date()
            },
            { where: { id: userId } }
          );
          socket.broadcast.to(`company-${companyId}`).emit("user:offline", {
            userId,
            lastSeen: new Date()
          });
        }, 30000);
      } catch (error) {
        logger.error("Error in handleHeartbeat:", error);
      }
    };

    //  NOVO: Handler para verificar aniversários quando usuário se conecta
    const checkAndEmitBirthdays = async (companyId: number) => {
      try {
        const birthdayData = await BirthdayService.getTodayBirthdaysForCompany(companyId);

        // Emitir eventos de aniversário se houver aniversariantes
        if (birthdayData.users.length > 0) {
          birthdayData.users.forEach(user => {
            socket.to(`company-${companyId}`).emit("user-birthday", {
              user: {
                id: user.id,
                name: user.name,
                age: user.age
              }
            });
            logger.info(` Emitido evento de aniversário para usuário: ${user.name}`);
          });
        }

        if (birthdayData.contacts.length > 0) {
          birthdayData.contacts.forEach(contact => {
            socket.to(`company-${companyId}`).emit("contact-birthday", {
              contact: {
                id: contact.id,
                name: contact.name,
                age: contact.age
              }
            });
            logger.info(` Emitido evento de aniversário para contato: ${contact.name}`);
          });
        }
      } catch (error) {
        logger.error(" Error checking birthdays:", error);
      }
    };

    //  EVENTO: Quando cliente se conecta
    socket.on("connect", async () => {
      try {
        if (token !== token_api_oficial) {
          const decoded = verify(token, authConfig.secret);
          const decodedPayload = decoded as JwtPayload;
          const userId = decodedPayload.id;
          const companyId = parseInt(socket.nsp.name.split("/")[1]);

          socket.join(`company-${companyId}`);

          // Buscar dados do usuário
          const user = await User.findByPk(userId, {
            attributes: ["id", "name", "profileImage", "lastSeen"]
          });

          socket.broadcast.to(`company-${companyId}`).emit("user:new", {
            userId,
            user
          });

          // Buscar usuários online
          const onlineUsers = await User.findAll({
            where: {
              companyId,
              online: true
            },
            attributes: ["id", "name", "profileImage", "lastSeen"]
          });

          socket.emit("users:online", onlineUsers);

          //  NOVO: Verificar e emitir aniversários quando usuário se conecta
          await checkAndEmitBirthdays(companyId);
        }
      } catch (error) {
        logger.error("Error in socket connect:", error);
      }
    });

    //  NOVO: Evento para solicitar verificação manual de aniversários
    socket.on("checkBirthdays", async () => {
      try {
        const companyId = parseInt(socket.nsp.name.split("/")[1]);
        await checkAndEmitBirthdays(companyId);
      } catch (error) {
        logger.error(" Error in manual birthday check:", error);
      }
    });

    // Eventos existentes
    socket.on("joinChatBox", (ticketId: string) => {
      socket.join(ticketId);
    });

    socket.on("joinNotification", () => {
      socket.join("notification");
    });

    socket.on("joinVersion", () => {
      logger.info(`A client joined version channel namespace ${socket.nsp.name}`);
      socket.join("version");
    });

    socket.on("joinTickets", (status: string) => {
      socket.join(status);
    });

    socket.on("joinTicketsLeave", (status: string) => {
      socket.leave(status);
    });

    socket.on("joinChatBoxLeave", (ticketId: string) => {
      socket.leave(ticketId);
    });

    socket.on("receivedMessageWhatsAppOficial", async (data: any) => {
      console.log(`[SOCKET] ===== MENSAGEM RECEBIDA VIA SOCKET =====`);
      console.log(`[SOCKET] CompanyId: ${data?.companyId}, From: ${data?.fromNumber}, Type: ${data?.message?.type}`);
      console.log(`[SOCKET] HasFile: ${!!data?.message?.file}, FileSize: ${data?.message?.file?.length || 0}`);

      try {
        const receivedService = new ReceibedWhatsAppService();
        await receivedService.getMessage(data);
      } catch (err) {
        logger.error(`[SOCKET] ❌ Erro não tratado ao processar mensagem recebida: ${err.message}`);
        logger.error(`[SOCKET] ❌ Stack: ${err.stack}`);
      }
    });

    socket.on("readMessageWhatsAppOficial", async (data: any) => {
      try {
        const receivedService = new ReceibedWhatsAppService();
        await receivedService.readMessage(data);
      } catch (err) {
        logger.error(`[SOCKET READ] ❌ Erro ao processar read message: ${err.message}`);
      }
    });

    // ✅ CORRIGIDO: Event handler para status updates de mensagens da Meta API
    socket.on("messageStatusUpdateWhatsAppOficial", async (data: any) => {
      try {
        console.log(`[SOCKET STATUS] ===== STATUS UPDATE RECEBIDO =====`);
        console.log(`[SOCKET STATUS] MessageId: ${data?.messageId}, Status: ${data?.status}, CompanyId: ${data?.companyId}`);
        console.log(`[SOCKET STATUS] Error data recebido: ${JSON.stringify(data?.error || null)}`);

        const { messageId, status, error, companyId } = data;

        if (!messageId || !companyId) {
          logger.warn(`[SOCKET STATUS] ⚠️ Status update inválido - faltam dados obrigatórios`);
          return;
        }

        // Buscar mensagem pelo wid
        const Message = (await import("../models/Message")).default;
        const Ticket = (await import("../models/Ticket")).default;
        const message = await Message.findOne({
          where: { wid: messageId, companyId },
          include: [{ model: Ticket, as: "ticket" }]
        });

        if (!message) {
          logger.warn(`[SOCKET STATUS] ⚠️ Mensagem ${messageId} não encontrada para companyId ${companyId}`);
          return;
        }

        logger.info(`[SOCKET STATUS] ✅ Mensagem encontrada - ID: ${message.id}, WID: ${messageId}, TicketId: ${message.ticketId}`);

        // Se status é falha, atualizar com erro
        if (status === 'failed' || status === 'undelivered') {
          // ✅ Extrair informação detalhada do erro da Meta
          const errorMessage = error?.error_data?.details
            || error?.message
            || error?.title
            || (typeof error === 'string' ? error : null)
            || 'Falha na entrega';
          const errorCode = error?.code?.toString() || 'UNKNOWN';

          logger.info(`[SOCKET STATUS] 🔴 Erro extraído: [${errorCode}] ${errorMessage}`);

          await message.update({
            deliveryError: errorMessage,
            deliveryErrorCode: errorCode,
            deliveryErrorAt: new Date(),
            ack: -1 // Indicar falha
          });

          logger.info(`[SOCKET STATUS] ✅ Mensagem ${message.id} atualizada com erro de entrega no banco`);

          // Recarregar mensagem com associações para emitir dados completos ao frontend
          await message.reload({
            include: [{ model: Ticket, as: "ticket" }]
          });

          // Emitir evento para atualizar UI
          const io = getIO();
          io.of(String(companyId)).emit(`company-${companyId}-appMessage`, {
            action: "update",
            message: message.toJSON()
          });

          logger.info(`[SOCKET STATUS] 📤 Evento emitido ao frontend - deliveryError: "${message.deliveryError}"`);
        }
        // Se status é sucesso, atualizar ack
        else if (status === 'sent') {
          await message.update({ ack: 1 });
          logger.info(`[SOCKET] ✅ Mensagem ${messageId} marcada como enviada (ack: 1)`);
        } else if (status === 'delivered') {
          await message.update({ ack: 2 });
          logger.info(`[SOCKET] ✅ Mensagem ${messageId} marcada como entregue (ack: 2)`);
        } else if (status === 'read') {
          await message.update({ ack: 3, read: true });
          logger.info(`[SOCKET] ✅ Mensagem ${messageId} marcada como lida (ack: 3)`);
        }
      } catch (error) {
        logger.error(`[SOCKET] Erro ao processar status update:`, error);
      }
    });


    // ✅ NOVO: Event handler para status updates de TEMPLATES da Meta API
    socket.on("templateStatusUpdateWhatsAppOficial", async (data: any) => {
      try {
        console.log(`[SOCKET] ===== TEMPLATE STATUS UPDATE RECEBIDO =====`);
        const { templateId, status, reason, companyId } = data;
        console.log(`[SOCKET] TemplateId: ${templateId}, Status: ${status}, CompanyId: ${companyId}`);

        if (!templateId || !companyId) {
          logger.warn(`[SOCKET] Template status update inválido - faltam dados obrigatórios`);
          return;
        }

        const QuickMessage = (await import("../models/QuickMessage")).default;

        // Buscar template pelo metaID
        const template = await QuickMessage.findOne({
          where: { metaID: templateId, companyId }
        });

        if (!template) {
          logger.warn(`[SOCKET] Template ${templateId} não encontrado para companyId ${companyId}`);
          return;
        }

        const updateData: any = {
          status: status
        };

        if (status === 'REJECTED' || status === 'PAUSED') {
          updateData.rejectionReason = reason;
        }

        await template.update(updateData);

        logger.info(`[SOCKET] ✅ Template ${template.shortcode} atualizado para ${status}`);

        // Emitir evento para atualizar UI
        const io = getIO();
        io.of(String(companyId))
          .emit(`company-${companyId}-quickmessage`, {
            action: "update",
            record: template
          });

      } catch (error) {
        logger.error(`[SOCKET] Erro ao processar template status update:`, error);
      }
    });

    //  NOVO: Heartbeat para manter usuário online e verificar aniversários periodicamente
    socket.on("heartbeat", () => handleHeartbeat(socket));

    //  EVENTO: Quando cliente se desconecta
    socket.on("disconnect", async () => {
      try {
        if (token !== token_api_oficial) {
          const companyId = parseInt(socket.nsp.name.split("/")[1]);
          const decoded = verify(token, authConfig.secret);
          const decodedPayload = decoded as JwtPayload;
          const userId = decodedPayload.id;

          await User.update(
            {
              online: false,
              lastSeen: new Date()
            },
            { where: { id: userId } }
          );

          socket.broadcast.to(`company-${companyId}`).emit("user:offline", {
            userId,
            lastSeen: new Date()
          });
        }
      } catch (error) {
        logger.error("Error in socket disconnect:", error);
      }
    });

  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};

//  NOVA FUNÇÃO: Emitir eventos de aniversário para uma empresa específica
export const emitBirthdayEvents = async (companyId: number) => {
  try {
    if (!io) {
      logger.warn(`[RDS-SOCKET] Socket IO não inicializado ao tentar emitir eventos de aniversário para empresa ${companyId}`);
      return;
    }

    const birthdayData = await BirthdayService.getTodayBirthdaysForCompany(companyId);

    // Emitir para todos os usuários da empresa
    if (birthdayData.users.length > 0) {
      birthdayData.users.forEach(user => {
        io.of(`/${companyId}`).emit("user-birthday", {
          user: {
            id: user.id,
            name: user.name,
            age: user.age
          }
        });
        logger.info(` [GLOBAL] Emitido evento de aniversário para usuário: ${user.name}`);
      });
    }

    if (birthdayData.contacts.length > 0) {
      birthdayData.contacts.forEach(contact => {
        io.of(`/${companyId}`).emit("contact-birthday", {
          contact: {
            id: contact.id,
            name: contact.name,
            age: contact.age
          }
        });
        logger.info(` [GLOBAL] Emitido evento de aniversário para contato: ${contact.name}`);
      });
    }
  } catch (error) {
    logger.error(` [RDS-SOCKET] Erro ao emitir eventos de aniversário para empresa ${companyId}:`,
      error instanceof Error ? error.message : "Unknown error");
    if (error instanceof Error && error.stack) {
      logger.debug(" [RDS-SOCKET] Error stack:", error.stack);
    }
  }
};
