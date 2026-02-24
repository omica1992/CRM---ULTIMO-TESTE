import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import {
  IReceivedWhatsppOficial,
  IReceivedWhatsppOficialRead,
} from 'src/@core/interfaces/IWebsocket.interface';

@Injectable()
export class SocketService implements OnModuleDestroy {
  private sockets: Map<number, Socket> = new Map();
  private connectErrorThrottle: Map<number, number> = new Map();
  private url: string;
  private logger: Logger = new Logger(`${SocketService.name}`);

  constructor() {
    this.url = process.env.URL_BACKEND_MULT100;
    if (!this.url) {
      this.logger.error('URL_BACKEND_MULT100 nao configurada no .env');
    }
  }

  onModuleDestroy() {
    this.sockets.forEach((socket, companyId) => {
      this.logger.log(`Fechando conexao com empresa ${companyId}`);
      socket.close();
    });
    this.sockets.clear();
  }

  private getOrCreateSocket(companyId: number): Socket {
    const cachedSocket = this.sockets.get(companyId);

    if (cachedSocket && (cachedSocket.connected || cachedSocket.active)) {
      return cachedSocket;
    }

    if (cachedSocket) {
      try {
        cachedSocket.removeAllListeners();
        cachedSocket.close();
      } catch (error: any) {
        this.logger.warn(`[SOCKET] Falha ao fechar socket antigo da empresa ${companyId}: ${error?.message}`);
      }
      this.sockets.delete(companyId);
    }

    this.logger.log(`[SOCKET] Criando nova conexao para empresa ${companyId}`);

    if (!this.url) {
      throw new Error('URL_BACKEND_MULT100 nao configurada');
    }

    const socket = io(`${this.url}/${companyId}`, {
      query: {
        token: `Bearer ${process.env.TOKEN_ADMIN || ''}`,
      },
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    this.setupSocketEvents(socket, companyId);
    this.sockets.set(companyId, socket);

    return socket;
  }

  private async waitForConnection(socket: Socket, companyId: number, timeoutMs = 10000): Promise<boolean> {
    if (socket.connected) {
      return true;
    }

    if (!socket.active) {
      socket.connect();
    }

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
        resolve(result);
      };

      const onConnect = () => cleanup(true);
      const onConnectError = (err: any) => {
        this.logger.warn(`[SOCKET WAIT] connect_error empresa ${companyId}: ${err?.message || err}`);
        cleanup(false);
      };

      const timer = setTimeout(() => {
        this.logger.warn(`[SOCKET WAIT] Timeout aguardando conexao da empresa ${companyId}`);
        cleanup(false);
      }, timeoutMs);

      socket.once('connect', onConnect);
      socket.once('connect_error', onConnectError);
    });
  }

  private async emitWithAck(
    companyId: number,
    eventName: string,
    payload: any,
    timeoutMs = 10000,
  ): Promise<boolean> {
    try {
      const socket = this.getOrCreateSocket(companyId);
      const isConnected = socket.connected || (await this.waitForConnection(socket, companyId, timeoutMs));

      if (!isConnected) {
        this.logger.warn(`[SOCKET EMIT] Sem conexao para empresa ${companyId} no evento ${eventName}`);
        return false;
      }

      return await new Promise<boolean>((resolve) => {
        socket.timeout(timeoutMs).emit(eventName, payload, (err: any, response?: { ok?: boolean; error?: string }) => {
          if (err) {
            this.logger.warn(`[SOCKET ACK] Timeout/falha no ACK do evento ${eventName} empresa ${companyId}: ${err?.message || err}`);
            return resolve(false);
          }

          if (response && response.ok === false) {
            this.logger.warn(`[SOCKET ACK] Backend rejeitou evento ${eventName} empresa ${companyId}: ${response.error || 'unknown error'}`);
            return resolve(false);
          }

          return resolve(true);
        });
      });
    } catch (error: any) {
      this.logger.error(`[SOCKET EMIT ERROR] Evento ${eventName} empresa ${companyId}: ${error?.message}`);
      return false;
    }
  }

  async sendMessage(data: IReceivedWhatsppOficial): Promise<boolean> {
    this.logger.log(`[SOCKET SEND] Enviando mensagem para empresa ${data.companyId}`);
    const sent = await this.emitWithAck(data.companyId, 'receivedMessageWhatsAppOficial', data, 12000);
    if (sent) this.logger.log(`[SOCKET SEND SUCCESS] Mensagem enviada para empresa ${data.companyId}`);
    else this.logger.warn(`[SOCKET SEND FAIL] Nao foi possivel enviar mensagem para empresa ${data.companyId}`);
    return sent;
  }

  async readMessage(data: IReceivedWhatsppOficialRead): Promise<boolean> {
    this.logger.log(`[SOCKET READ] Enviando status de leitura para empresa ${data.companyId}`);
    const sent = await this.emitWithAck(data.companyId, 'readMessageWhatsAppOficial', data);
    if (sent) this.logger.log(`[SOCKET READ SUCCESS] Status de leitura enviado para empresa ${data.companyId}`);
    else this.logger.warn(`[SOCKET READ FAIL] Nao foi possivel enviar read para empresa ${data.companyId}`);
    return sent;
  }

  async sendStatusUpdate(data: {
    companyId: number;
    messageId: string;
    status: string;
    timestamp: string;
    error?: any;
    token: string;
  }): Promise<boolean> {
    this.logger.log(
      `[SOCKET STATUS UPDATE] Enviando status update para empresa ${data.companyId} - MessageId: ${data.messageId}, Status: ${data.status}`,
    );
    const sent = await this.emitWithAck(data.companyId, 'messageStatusUpdateWhatsAppOficial', data);
    if (sent) this.logger.log(`[SOCKET STATUS UPDATE SUCCESS] Status update enviado para empresa ${data.companyId}`);
    else this.logger.warn(`[SOCKET STATUS UPDATE FAIL] Falha ao enviar status update para empresa ${data.companyId}`);
    return sent;
  }

  async sendTemplateStatusUpdate(data: {
    companyId: number;
    templateId: string;
    previousCategory?: string;
    newCategory?: string;
    status: string;
    reason?: string;
    token: string;
  }): Promise<boolean> {
    this.logger.log(
      `[SOCKET TEMPLATE UPDATE] Enviando template status para empresa ${data.companyId} - TemplateId: ${data.templateId}, Status: ${data.status}`,
    );
    const sent = await this.emitWithAck(data.companyId, 'templateStatusUpdateWhatsAppOficial', data);
    if (sent) this.logger.log(`[SOCKET TEMPLATE UPDATE SUCCESS] Template status enviado para empresa ${data.companyId}`);
    else this.logger.warn(`[SOCKET TEMPLATE UPDATE FAIL] Falha ao enviar template status para empresa ${data.companyId}`);
    return sent;
  }

  private setupSocketEvents(socket: Socket, companyId: number): void {
    socket.on('connect', () => {
      this.logger.log(
        `[SOCKET CONNECTED] Empresa ${companyId} conectada ao servidor ${this.url}/${companyId}`,
      );
      this.connectErrorThrottle.delete(companyId);
    });

    socket.on('connect_error', (error) => {
      const now = Date.now();
      const last = this.connectErrorThrottle.get(companyId) || 0;
      if (now - last >= 10000) {
        this.logger.error(
          `[SOCKET ERROR] Erro de conexao empresa ${companyId}: ${error}`,
        );
        this.connectErrorThrottle.set(companyId, now);
      }
    });

    socket.on('disconnect', (reason) => {
      this.logger.warn(
        `[SOCKET DISCONNECTED] Empresa ${companyId} desconectada. Razao: ${reason}`,
      );

      if (reason !== 'io client disconnect') {
        this.logger.log(
          `[SOCKET] Removendo conexao da empresa ${companyId} do cache`,
        );
        this.sockets.delete(companyId);
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      this.logger.log(
        `[SOCKET RECONNECTED] Empresa ${companyId} reconectada apos ${attemptNumber} tentativas`,
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
