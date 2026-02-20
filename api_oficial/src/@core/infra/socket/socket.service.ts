import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import {
  IReceivedWhatsppOficial,
  IReceivedWhatsppOficialRead,
} from 'src/@core/interfaces/IWebsocket.interface';

@Injectable()
export class SocketService implements OnModuleDestroy {
  private sockets: Map<number, Socket> = new Map();
  private url: string;

  private logger: Logger = new Logger(`${SocketService.name}`);

  constructor() {
    this.url = process.env.URL_BACKEND_MULT100;
    if (!this.url) {
      this.logger.error('URL_BACKEND_MULT100 não configurada no .env');
    }
  }

  onModuleDestroy() {
    // Fechar todas as conexões ao desligar o módulo
    this.sockets.forEach((socket, companyId) => {
      this.logger.log(`Fechando conexão com empresa ${companyId}`);
      socket.close();
    });
    this.sockets.clear();
  }

  private getOrCreateSocket(companyId: number): Socket {
    // Verificar se já existe conexão ativa
    let socket = this.sockets.get(companyId);

    if (socket && socket.connected) {
      this.logger.log(`[SOCKET] Reutilizando conexão existente para empresa ${companyId}`);
      return socket;
    }

    // Criar nova conexão
    this.logger.log(`[SOCKET] Criando nova conexão para empresa ${companyId}`);

    try {
      if (!this.url) {
        throw new Error('URL_BACKEND_MULT100 não configurada');
      }

      socket = io(`${this.url}/${companyId}`, {
        query: {
          token: `Bearer ${process.env.TOKEN_ADMIN || ''}`,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity, // ✅ BUG 8 FIX: Reconexão infinita com backoff
      });

      this.setupSocketEvents(socket, companyId);
      this.sockets.set(companyId, socket);

      return socket;
    } catch (error: any) {
      this.logger.error(
        `[SOCKET ERROR] Erro ao conectar empresa ${companyId}: ${error.message}`,
      );
      throw error;
    }
  }

  sendMessage(data: IReceivedWhatsppOficial) {
    try {
      this.logger.log(
        `[SOCKET SEND] Enviando mensagem para empresa ${data.companyId}`,
      );

      const socket = this.getOrCreateSocket(data.companyId);
      socket.emit('receivedMessageWhatsAppOficial', data);

      this.logger.log(
        `[SOCKET SEND SUCCESS] Mensagem enviada para empresa ${data.companyId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[SOCKET SEND ERROR] Erro ao enviar mensagem para empresa ${data.companyId}: ${error?.message}`,
      );
    }
  }

  readMessage(data: IReceivedWhatsppOficialRead) {
    try {
      this.logger.log(
        `[SOCKET READ] Enviando status de leitura para empresa ${data.companyId}`,
      );

      const socket = this.getOrCreateSocket(data.companyId);
      socket.emit('readMessageWhatsAppOficial', data);

      this.logger.log(
        `[SOCKET READ SUCCESS] Status de leitura enviado para empresa ${data.companyId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[SOCKET READ ERROR] Erro ao enviar status de leitura para empresa ${data.companyId}: ${error?.message}`,
      );
    }
  }

  // ✅ NOVO: Enviar status update de mensagem (sent, delivered, read, failed)
  sendStatusUpdate(data: {
    companyId: number;
    messageId: string;
    status: string;
    timestamp: string;
    error?: any;
    token: string;
  }) {
    try {
      this.logger.log(
        `[SOCKET STATUS UPDATE] Enviando status update para empresa ${data.companyId} - MessageId: ${data.messageId}, Status: ${data.status}`,
      );

      const socket = this.getOrCreateSocket(data.companyId);
      socket.emit('messageStatusUpdateWhatsAppOficial', data);

      this.logger.log(
        `[SOCKET STATUS UPDATE SUCCESS] Status update enviado para empresa ${data.companyId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[SOCKET STATUS UPDATE ERROR] Erro ao enviar status update para empresa ${data.companyId}: ${error?.message}`,
      );
    }
  }

  // ✅ NOVO: Enviar status update de template (APPROVED, REJECTED, PAUSED)
  sendTemplateStatusUpdate(data: {
    companyId: number;
    templateId: string;
    previousCategory?: string;
    newCategory?: string;
    status: string;
    reason?: string;
    token: string;
  }) {
    try {
      this.logger.log(
        `[SOCKET TEMPLATE UPDATE] Enviando template status para empresa ${data.companyId} - TemplateId: ${data.templateId}, Status: ${data.status}`,
      );

      const socket = this.getOrCreateSocket(data.companyId);
      socket.emit('templateStatusUpdateWhatsAppOficial', data);

      this.logger.log(
        `[SOCKET TEMPLATE UPDATE SUCCESS] Template status enviado para empresa ${data.companyId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[SOCKET TEMPLATE UPDATE ERROR] Erro ao enviar template status para empresa ${data.companyId}: ${error?.message}`,
      );
    }
  }

  private setupSocketEvents(socket: Socket, companyId: number): void {
    socket.on('connect', () => {
      this.logger.log(
        `[SOCKET CONNECTED] Empresa ${companyId} conectada ao servidor ${this.url}/${companyId}`,
      );
    });

    socket.on('connect_error', (error) => {
      this.logger.error(
        `[SOCKET ERROR] Erro de conexão empresa ${companyId}: ${error}`,
      );
    });

    socket.on('disconnect', (reason) => {
      this.logger.warn(
        `[SOCKET DISCONNECTED] Empresa ${companyId} desconectada. Razão: ${reason}`,
      );

      // Remover do cache se desconexão não foi intencional
      if (reason !== 'io client disconnect') {
        this.logger.log(
          `[SOCKET] Removendo conexão da empresa ${companyId} do cache`,
        );
        this.sockets.delete(companyId);
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      this.logger.log(
        `[SOCKET RECONNECTED] Empresa ${companyId} reconectada após ${attemptNumber} tentativas`,
      );
    });

    socket.on('reconnect_failed', () => {
      this.logger.error(
        `[SOCKET RECONNECT FAILED] Falha ao reconectar empresa ${companyId}`,
      );
      this.sockets.delete(companyId);
    });
  }
}
