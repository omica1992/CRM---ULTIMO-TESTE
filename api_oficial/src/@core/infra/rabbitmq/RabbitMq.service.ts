import { Logger } from '@nestjs/common';
import { connect, Connection, Channel, Message } from 'amqplib';
import { WhatsAppOficial } from 'src/@core/domain/entities/whatsappOficial.model';

export class RabbitMQService {
  private connection: any = null;
  private channel: any = null;
  private url: string;
  private logger: Logger = new Logger(`${RabbitMQService.name}`);
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.RABBITMQ_ENABLED_GLOBAL === 'true';
    if (this.isEnabled) {
      this.logger.log('🐰 RabbitMQ está ativado globalmente');
      this.connect();
    } else {
      this.logger.warn('⚠️  RabbitMQ está desativado globalmente');
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.isEnabled) return;

      this.url = process.env.RABBITMQ_URL;
      if (!this.url) {
        throw new Error('RABBITMQ_URL não está definida nas variáveis de ambiente');
      }

      this.connection = await connect(this.url);
      this.channel = await this.connection.createChannel();
      this.logger.log('📡 Conexão com RabbitMQ estabelecida com sucesso');
    } catch (error) {
      this.logger.error(`❌ Erro ao conectar com RabbitMQ: ${error}`);
      console.log(error);
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.isEnabled) return false;

    if (!this.connection || !this.channel) {
      await this.connect();
    }

    return !!(this.connection && this.channel);
  }

  async publish(queue: string, message: string): Promise<void> {
    if (!(await this.ensureConnection())) return;
    await this.channel!.assertQueue(queue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
    this.channel!.sendToQueue(queue, Buffer.from(message), { persistent: true });
  }

  async consume(
    queue: string,
    callback: (message: string) => void,
  ): Promise<void> {
    if (!(await this.ensureConnection())) return;
    await this.channel!.assertQueue(queue, { durable: true });
    await this.channel!.consume(queue, (msg: any) => {
      if (msg !== null && this.channel) {
        callback(msg.content.toString());
        this.channel.ack(msg);
      }
    });
  }

  async sendToRabbitMQ(whats: WhatsAppOficial, body: any) {
    try {
      if (!(await this.ensureConnection())) return;

      if (!whats) throw new Error('Nenhum valor informado');

      if (!whats.use_rabbitmq) throw new Error('Configuração não ativa');

      const exchange = whats.rabbitmq_exchange;
      const queue = whats.rabbitmq_queue;
      const routingKey = whats.rabbitmq_routing_key || '';

      this.logger.log(
        `Declarando exchange '${exchange}' do tipo 'topic' para a empresa ${whats.companyId}...`,
      );
      await this.channel!.assertExchange(exchange, 'topic', { durable: true });

      this.logger.log(
        `Declarando fila '${queue}' do tipo 'quorum' para a empresa ${whats.companyId}...`,
      );
      await this.channel!.assertQueue(queue, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
      });

      this.logger.log(
        `Vinculando fila '${queue}' à exchange '${exchange}' com routing key '${routingKey}' para a empresa ${whats.companyId}...`,
      );
      await this.channel!.bindQueue(queue, exchange, routingKey);

      this.channel!.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        { deliveryMode: 1 },
      );
      this.logger.log(
        `Mensagem enviada para o RabbitMQ para a empresa ${whats.companyId}`,
        { body },
      );

      this.close();
    } catch (error: any) {
      this.logger.error(
        `Erro ao enviar para o RabbitMQ para a empresa ${whats.companyId}`,
        { error: error.message },
      );
      throw new Error(
        `Erro ao enviar para o RabbitMQ para a empresa ${whats.companyId}`,
      );
    }
  }

  async close(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (error) {
      this.logger.error(`Erro ao fechar conexão RabbitMQ: ${error}`);
    }
  }
}
