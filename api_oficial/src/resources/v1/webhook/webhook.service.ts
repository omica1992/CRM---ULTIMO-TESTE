import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { WhatsAppOficial } from 'src/@core/domain/entities/whatsappOficial.model';
import { AppError } from 'src/@core/infra/errors/app.error';
import { RedisService } from 'src/@core/infra/redis/RedisService.service';
import { RabbitMQService } from 'src/@core/infra/rabbitmq/RabbitMq.service';
import {
  IWebhookWhatsApp,
  IWebhookWhatsAppEntryChangesValueMessages,
} from './interfaces/IWebhookWhatsApp.inteface';
import { SocketService } from 'src/@core/infra/socket/socket.service';
import {
  IMessageReceived,
  IReceivedWhatsppOficial,
} from 'src/@core/interfaces/IWebsocket.interface';
import { MetaService } from 'src/@core/infra/meta/meta.service';

@Injectable()
export class WebhookService {
  private logger: Logger = new Logger(`${WebhookService.name}`);
  private messagesPermitidas = [
    'text',
    'image',
    'audio',
    'document',
    'video',
    'location',
    'contacts',
    'order',
    'interactive',
    'referral',
    'sticker',
    'system',
    'button',
    'reaction',
    'unsupported',
  ];

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly whatsAppService: WhatsappOficialService,
    private readonly redis: RedisService,
    private readonly socket: SocketService,
    private readonly meta: MetaService,
  ) { }

  async forwardToWebhook(whats: WhatsAppOficial, body: any) {
    try {
      const {
        n8n_webhook_url,
        auth_token_n8n,
        chatwoot_webhook_url,
        auth_token_chatwoot,
        typebot_webhook_url,
        auth_token_typebot,
        crm_webhook_url,
        auth_token_crm,
      } = whats;

      this.logger.log(`[FORWARD WEBHOOK] Verificando webhooks configurados...`);
      this.logger.log(`[FORWARD WEBHOOK] n8n: ${!!n8n_webhook_url ? 'SIM' : 'NÃO'}, chatwoot: ${!!chatwoot_webhook_url ? 'SIM' : 'NÃO'}, typebot: ${!!typebot_webhook_url ? 'SIM' : 'NÃO'}, crm: ${!!crm_webhook_url ? 'SIM' : 'NÃO'}`);

      try {
        if (!!n8n_webhook_url) {
          this.logger.log(`[FORWARD WEBHOOK] Enviando para n8n: ${n8n_webhook_url}`);
          await this.sendToWebhook(n8n_webhook_url, auth_token_n8n, body);
        }

        if (!!chatwoot_webhook_url) {
          this.logger.log(`[FORWARD WEBHOOK] Enviando para chatwoot: ${chatwoot_webhook_url}`);
          await this.sendToWebhook(chatwoot_webhook_url, auth_token_chatwoot, body);
        }

        if (!!typebot_webhook_url) {
          this.logger.log(`[FORWARD WEBHOOK] Enviando para typebot: ${typebot_webhook_url}`);
          await this.sendToWebhook(typebot_webhook_url, auth_token_typebot, body);
        }

        if (!!crm_webhook_url) {
          this.logger.log(`[FORWARD WEBHOOK] Enviando para CRM: ${crm_webhook_url}`);
          await this.sendToWebhook(crm_webhook_url, auth_token_crm, body);
        }
      } catch (error: any) {
        this.logger.error(
          `forwardToWebhook - Erro ao enviar webhook - ${error.message}`,
        );
        throw new AppError(error.message, HttpStatus.BAD_REQUEST);
      }
    } catch (error: any) {
      this.logger.error(
        `forwardToWebhook - Erro nos webhook - ${error.message}`,
      );
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async sendToWebhook(webhook_url: string, token: string, body: any) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      this.logger.log('Resposta do encaminhamento do webhook', {
        webhook_url,
        responseData,
      });
    } catch (error: any) {
      this.logger.error('Erro ao encaminhar para o webhook', {
        erro: error.message,
        webhook_url,
      });
      return null;
    }
  }

  async webhookCompanyConexao(companyId: number, conexaoId: number, data: any) {
    const startTime = Date.now();
    this.logger.log(`[WEBHOOK START] CompanyId: ${companyId}, ConexaoId: ${conexaoId}`);

    try {
      const company = await this.whatsAppService.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) throw new Error('Empresa não encontrada');
      this.logger.log(`[WEBHOOK] Empresa encontrada: ${company.id}`);

      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst(
        {
          where: { id: conexaoId, companyId, deleted_at: null },
          include: { company: true },
        },
      );

      if (!whats) throw new Error('Configuração não encontrada');
      this.logger.log(`[WEBHOOK] Configuração encontrada: ${whats.id}`);

      this.logger.log(`[WEBHOOK DEBUG] Data recebido:`, JSON.stringify(data).substring(0, 200));
      const body: IWebhookWhatsApp = data?.body || data;
      this.logger.log(`[WEBHOOK DEBUG] Body parseado:`, JSON.stringify(body).substring(0, 200));

      // Validar estrutura do webhook
      if (!body || !body.object) {
        throw new AppError('Estrutura do webhook inválida: objeto não encontrado', HttpStatus.BAD_REQUEST);
      }

      if (body.object === 'whatsapp_business_account' && !body.entry) {
        throw new AppError('Estrutura do webhook inválida: entry não encontrado', HttpStatus.BAD_REQUEST);
      }

      // Proteção contra reprocessamento de mensagens duplicadas
      this.logger.log(`[WEBHOOK] Body object: ${body.object}`);

      if (body.object == 'whatsapp_business_account' && body.entry) {
        const { entry } = body;
        this.logger.log(`[WEBHOOK] Processando mensagens e status para ${entry.length} entries`);

        for (const e of entry) {
          for (const change of e.changes) {
            if (change.field == 'messages') {
              const { value } = change;

              if (value?.statuses != null) {
                this.logger.log(`[WEBHOOK STATUS] 📬 Processando ${value.statuses.length} status updates`);
                for (const status of value.statuses) {
                  this.logger.log(
                    `[WEBHOOK STATUS] 📨 MessageId: ${status.id}, Status: ${status.status}, Timestamp: ${status.timestamp}, Recipient: ${status.recipient_id || 'N/A'}`,
                  );

                  // Log adicional para status de entrega
                  if (status.status === 'delivered') {
                    this.logger.log(`[WEBHOOK STATUS] ✅ DELIVERED - Mensagem ${status.id} foi ENTREGUE ao destinatário`);
                  } else if (status.status === 'sent') {
                    this.logger.log(`[WEBHOOK STATUS] 🚀 SENT - Mensagem ${status.id} foi ENVIADA (aguardando entrega)`);
                  } else if (status.status === 'read') {
                    this.logger.log(`[WEBHOOK STATUS] 👀 READ - Mensagem ${status.id} foi LIDA pelo destinatário`);
                  } else if (status.status === 'failed') {
                    this.logger.error(`[WEBHOOK STATUS] ❌ FAILED - Mensagem ${status.id} FALHOU: ${JSON.stringify((status as any).errors || {})}`);
                  }

                  const statusData = {
                    companyId: company.idEmpresaMult100,
                    messageId: status.id,
                    status: status.status,
                    timestamp: status.timestamp,
                    error: (status as any).errors?.[0],
                    token: whats.token_mult100,
                  };

                  // Tentar enviar via RabbitMQ primeiro, fallback para socket
                  try {
                    await this.rabbit.publish('whatsapp_oficial_status', JSON.stringify(statusData));
                    this.logger.log(`[WEBHOOK RABBITMQ STATUS] Status enviando via fila para empresa ${statusData.companyId}`);
                  } catch (err: any) {
                    this.logger.warn(`[WEBHOOK RABBITMQ ERROR] Falha ao enviar para RabbitMQ, fazendo fallback para Socket: ${err.message}`);
                    this.socket.sendStatusUpdate(statusData);
                  }

                  // Manter compatibilidade: ainda enviar readMessage para status de leitura
                  if (status.status === 'read') {
                    this.socket.readMessage({
                      companyId: company.idEmpresaMult100,
                      messageId: status.id,
                      token: whats.token_mult100,
                    });
                  }
                }
              } else {
                const contact = value.contacts?.[0];
                const contactName = contact?.profile?.name || contact?.wa_id || 'Desconhecido';
                this.logger.log(`[WEBHOOK MESSAGE] Processando ${value.messages.length} mensagens do contato ${contactName}`);

                for (const message of value.messages) {
                  this.logger.log(`[WEBHOOK MESSAGE] Tipo: ${message.type}, ID: ${message.id}`);

                  const messageKey = `webhook:processed:${companyId}:${message.id}`;
                  const alreadyProcessed = await this.redis.get(messageKey);

                  if (alreadyProcessed) {
                    this.logger.warn(`[WEBHOOK DUPLICATE] Mensagem ${message.id} já foi processada. Ignorando para evitar loop.`);
                    continue;
                  }

                  if (this.messagesPermitidas.some((m) => m == message.type)) {
                    this.logger.log(`[WEBHOOK MESSAGE PROCESSING] Tipo de mensagem permitido: ${message.type}`);

                    if (!!whats.use_rabbitmq) {
                      const exchange = companyId;
                      const queue = `${whats.phone_number}`.replace('+', '');
                      const routingKey = whats.rabbitmq_routing_key;

                      this.logger.log(`[WEBHOOK RABBITMQ] Enviando para RabbitMQ: exchange=${exchange}, queue=${queue}`);
                      await this.rabbit.sendToRabbitMQ(whats, body);
                      this.logger.log(
                        `[WEBHOOK RABBITMQ SUCCESS] Enviado para o RabbitMQ. Fila '${queue}' vinculada à exchange '${exchange}' ${!!routingKey ? `com routing key '${routingKey}` : ''}`,
                      );
                    }

                    this.logger.log(`[WEBHOOK REDIS] Salvando mensagem no Redis`);

                    try {
                      const messages = await this.redis.get(
                        `messages:${companyId}:${conexaoId}`,
                      );

                      let messagesStored: Array<any> = [];

                      if (!!messages) {
                        try {
                          messagesStored = JSON.parse(messages) as Array<any>;
                          // Garantir que é array
                          if (!Array.isArray(messagesStored)) {
                            messagesStored = [];
                          }
                        } catch (parseError: any) {
                          this.logger.error(`[WEBHOOK REDIS] Erro ao parsear mensagens existentes: ${parseError?.message || 'Unknown error'}`);
                          messagesStored = [];
                        }
                      }

                      // Adicionar nova mensagem
                      messagesStored.push(body);

                      // Limitar a 50 mensagens para evitar crescimento infinito
                      if (messagesStored.length > 50) {
                        messagesStored = messagesStored.slice(-50);
                        this.logger.log(`[WEBHOOK REDIS] Array limitado a 50 mensagens`);
                      }

                      // Serializar com tratamento de erro
                      try {
                        const serialized = JSON.stringify(messagesStored);
                        await this.redis.set(
                          `messages:${companyId}:${conexaoId}`,
                          serialized,
                        );
                        this.logger.log(`[WEBHOOK REDIS] ${messagesStored.length} mensagens salvas no Redis`);
                      } catch (stringifyError: any) {
                        this.logger.error(`[WEBHOOK REDIS] Erro ao serializar JSON: ${stringifyError?.message || 'Unknown error'}`);
                        // Tentar salvar apenas a mensagem atual sem histórico
                        const simplifiedBody = {
                          object: body.object,
                          entry: body.entry?.map(e => ({
                            id: e.id,
                            changes: e.changes?.map(c => ({
                              field: c.field,
                              value: {
                                messaging_product: c.value?.messaging_product,
                                metadata: c.value?.metadata,
                                messages: c.value?.messages?.map(m => ({
                                  id: m.id,
                                  type: m.type,
                                  timestamp: m.timestamp,
                                  from: m.from
                                }))
                              }
                            }))
                          }))
                        };
                        await this.redis.set(
                          `messages:${companyId}:${conexaoId}`,
                          JSON.stringify([simplifiedBody]),
                        );
                        this.logger.log(`[WEBHOOK REDIS] Salva versão simplificada devido a erro de serialização`);
                      }
                    } catch (redisError: any) {
                      this.logger.error(`[WEBHOOK REDIS ERROR] Erro ao salvar no Redis: ${redisError?.message || 'Unknown error'}`);
                      // Não propagar erro - continuar processamento mesmo se Redis falhar
                    }

                    this.logger.log(
                      '[WEBHOOK SOCKET] Enviando mensagem para o servidor do websocket',
                    );

                    let file;
                    let idFile;
                    let bodyMessage;
                    let quoteMessageId;
                    switch (message.type) {
                      case 'video':
                        idFile = message.video.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'document':
                        idFile = message.document.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'image':
                        idFile = message.image.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'audio':
                        idFile = message.audio.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'interactive':
                        file = null;
                        bodyMessage =
                          message.interactive.button_reply?.id ||
                          message.interactive.list_reply?.id;
                        break;
                      case 'location':
                        bodyMessage = JSON.stringify(message.location);
                        break;
                      case 'contacts':
                        bodyMessage = {
                          contacts: message.contacts,
                        };
                        break;
                      case 'sticker':
                        idFile = message.sticker.id;
                        file = await this.meta.downloadFileMeta(
                          idFile,
                          change.value.metadata.phone_number_id,
                          whats.send_token,
                          company.id,
                          whats.id,
                        );
                        break;
                      case 'order':
                        bodyMessage = JSON.stringify(message.order);
                        break;
                      case 'reaction':
                        file = null;
                        bodyMessage = message.reaction?.emoji || 'reagiu a uma mensagem';
                        quoteMessageId = message.reaction?.message_id;
                        break;
                      case 'button':
                        file = null;
                        bodyMessage = message.button?.text;
                        break;
                      case 'system':
                        file = null;
                        bodyMessage = message.system?.body || 'Mensagem de sistema';
                        break;
                      case 'unsupported':
                        file = null;
                        bodyMessage = 'Mensagem não suportada pelo sistema. Verifique no aplicativo do WhatsApp.';
                        break;
                      default:
                        file = null;
                        bodyMessage = message.text?.body || '';
                        quoteMessageId = message.context?.id;
                        break;
                    }

                    const msg: IMessageReceived = {
                      timestamp: +message.timestamp,
                      type: message.type,
                      text: bodyMessage,
                      file: !!file ? file.base64 : null,
                      mimeType: !!file ? file.mimeType : null,
                      idFile,
                      idMessage: message.id,
                      quoteMessageId,
                    };

                    const data: IReceivedWhatsppOficial = {
                      companyId: company.idEmpresaMult100,
                      nameContact: contactName,
                      message: msg,
                      token: whats.token_mult100,
                      fromNumber: message.from,
                    };

                    // Enviar via fila global consolidada de RabbitMQ com fallback
                    try {
                      await this.rabbit.publish('whatsapp_oficial', JSON.stringify(data));
                      this.logger.log(`[WEBHOOK RABBITMQ SUCCESS] Mensagem de ${data.fromNumber} enviada via fila global 'whatsapp_oficial'`);
                    } catch (err: any) {
                      this.logger.warn(`[WEBHOOK RABBITMQ ERROR] Falha na fila, fallback de mensagem para socket: ${err.message}`);
                      this.socket.sendMessage(data);
                    }

                    // Encaminhar para webhooks externos apenas se não for um reprocessamento
                    this.logger.log(`[WEBHOOK FORWARD] Iniciando encaminhamento para webhooks externos`);
                    try {
                      await this.forwardToWebhook(whats, body);
                      this.logger.log('[WEBHOOK FORWARD SUCCESS] Enviado para webhooks externos com sucesso.');
                    } catch (error: any) {
                      this.logger.error(
                        `[WEBHOOK FORWARD ERROR] Erro ao encaminhar webhook: ${error.message}`,
                      );
                      if (error.stack) {
                        this.logger.error(`[WEBHOOK FORWARD ERROR STACK] ${error.stack}`);
                      }
                      // Não propagar erro para não bloquear processamento
                    }

                    // MARCAR COMO PROCESSADA APENAS APÓS SUCESSO DE TUDO
                    this.logger.log(`[WEBHOOK MARK] Marcando mensagem ${message.id} como processada (Sucesso)`);
                    await this.redis.setex(messageKey, 300, 'true');
                  }
                }
              }
            } else if (change.field === 'message_template_status_update') {
              const value: any = change.value;

              this.logger.log(`[WEBHOOK TEMPLATE] 📋 Status update recebido: ${JSON.stringify(value)}`);

              // O evento pode ser APPROVED, REJECTED, PAUSED, FLAGGED, DISABLED
              const updateData = {
                companyId: company.idEmpresaMult100,
                templateId: value.message_template_id,
                previousCategory: value.previous_category,
                newCategory: value.new_category,
                status: value.event,
                reason: value.reason,
                token: whats.token_mult100
              };

              this.logger.log(`[WEBHOOK TEMPLATE] 🚀 Enviando update via socket para Backend: ${JSON.stringify(updateData)}`);

              this.socket.sendTemplateStatusUpdate(updateData);
            }
          }
        }

        const duration = Date.now() - startTime;
        this.logger.log(`[WEBHOOK END] Processamento concluído em ${duration}ms`);
        return true;
      } else {
        this.logger.error(`[WEBHOOK ERROR] Evento não tratado: ${JSON.stringify(body)}`);
      }

      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[WEBHOOK ERROR] Erro no POST /webhook/:companyId/:conexaoId após ${duration}ms - ${error.message}`,
      );

      if (error.stack) {
        // Mostrar apenas as primeiras 10 linhas do stack para não poluir
        const stackLines = error.stack.split('\n').slice(0, 10).join('\n');
        this.logger.error(`[WEBHOOK ERROR STACK]\n${stackLines}`);
      }

      this.logger.error(`[WEBHOOK ERROR CONTEXT] CompanyId: ${companyId}, ConexaoId: ${conexaoId}`);

      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async webhookCompany(
    companyId: number,
    conexaoId: number,
    mode: string,
    verify_token: string,
    challenge: string,
  ) {
    try {
      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst(
        { where: { id: conexaoId, companyId, deleted_at: null } },
      );

      if (!whats) throw new Error('Configuração não encontrada');

      if (mode === 'subscribe' && verify_token === whats.token_mult100) {
        this.logger.log('WEBHOOK VERIFICADO para a empresa:', companyId);

        return challenge;
      } else {
        this.logger.error(
          'Falha na verificação do webhook para a empresa:',
          companyId,
        );
        throw new Error(
          `Falha na verificação do webhook para a empresa: ${companyId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`webhookCompany - ${error.message}`);
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
