import amqplib, { Channel, Connection } from "amqplib";
import logger from "../../utils/logger";
import { ReceibedWhatsAppService } from "../WhatsAppOficial/ReceivedWhatsApp";
import AppError from "../../errors/AppError";

class RabbitMQListener {
    private connection: any = null;
    private channel: any = null;
    private readonly queues = ["whatsapp_oficial", "whatsapp_oficial_status"];

    public async connect(): Promise<void> {
        try {
            const rabbitmqUrl = process.env.RABBITMQ_URL;

            if (!rabbitmqUrl) {
                logger.warn("RABBITMQ_URL not found in environment variables. RabbitMQ listener will not start.");
                return;
            }

            this.connection = await amqplib.connect(rabbitmqUrl);
            this.channel = await this.connection.createChannel();

            logger.info("[RabbitMQ] 🐰 Connected to RabbitMQ server successfully.");

            // Setup consumers
            await this.setupConsumers();

            // Handle connection closures
            this.connection.on("error", (err) => {
                logger.error(`[RabbitMQ] Connection error: ${err.message}`);
                this.reconnect();
            });

            this.connection.on("close", () => {
                logger.warn("[RabbitMQ] Connection closed. Attempting to reconnect...");
                this.reconnect();
            });

        } catch (error) {
            logger.error(`[RabbitMQ] Failed to connect: ${error}`);
            setTimeout(() => this.connect(), 5000); // Retry after 5s
        }
    }

    private async setupConsumers(): Promise<void> {
        if (!this.channel) return;

        try {
            // 1. Queue for incoming messages
            const messageQueue = this.queues[0];
            await this.channel.assertQueue(messageQueue, { durable: true, arguments: { "x-queue-type": "quorum" } });

            this.channel.consume(messageQueue, async (msg) => {
                if (msg !== null) {
                    try {
                        const data = JSON.parse(msg.content.toString());
                        logger.info(`[RabbitMQ] 📩 Received message via RabbitMQ | Company: ${data?.companyId}`);

                        const receivedService = new ReceibedWhatsAppService();
                        await receivedService.getMessage(data);

                        this.channel?.ack(msg);
                    } catch (error) {
                        logger.error(`[RabbitMQ] ❌ Error processing message: ${error}`);
                        // Nack the message and ask RabbitMQ to requeue or drop based on rules
                        this.channel?.nack(msg, false, false);
                    }
                }
            });

            // 2. Queue for message statuses (if api_oficial supports sending them to rabbit)
            const statusQueue = this.queues[1];
            await this.channel.assertQueue(statusQueue, { durable: true, arguments: { "x-queue-type": "quorum" } });

            this.channel.consume(statusQueue, async (msg) => {
                if (msg !== null) {
                    try {
                        const data = JSON.parse(msg.content.toString());
                        logger.info(`[RabbitMQ] 📊 Received status update via RabbitMQ | Company: ${data?.companyId}`);

                        // Replicate the logic from socket.ts for messageStatusUpdateWhatsAppOficial
                        await this.processMessageStatus(data);

                        this.channel?.ack(msg);
                    } catch (error) {
                        logger.error(`[RabbitMQ] ❌ Error processing status update: ${error}`);
                        this.channel?.nack(msg, false, false);
                    }
                }
            });

            logger.info(`[RabbitMQ] 🎧 Consumers registered for queues: ${this.queues.join(", ")}`);
        } catch (error) {
            logger.error(`[RabbitMQ] Error setting up consumers: ${error}`);
        }
    }

    private async processMessageStatus(data: any): Promise<void> {
        const { messageId, status, error, companyId } = data;

        if (!messageId || !companyId) {
            logger.warn(`[RabbitMQ STATUS] ⚠️ Invalid status update - missing required fields`);
            return;
        }

        const Message = (await import("../../models/Message")).default;
        const Ticket = (await import("../../models/Ticket")).default;

        const message = await Message.findOne({
            where: { wid: messageId, companyId },
            include: [{ model: Ticket, as: "ticket" }]
        });

        if (!message) {
            logger.warn(`[RabbitMQ STATUS] ⚠️ Message ${messageId} not found for company ${companyId}`);
            return;
        }

        if (status === 'failed' || status === 'undelivered') {
            const errorMessage = error?.error_data?.details
                || error?.message
                || error?.title
                || (typeof error === 'string' ? error : null)
                || 'Falha na entrega';
            const errorCode = error?.code?.toString() || 'UNKNOWN';

            await message.update({
                deliveryError: errorMessage,
                deliveryErrorCode: errorCode,
                deliveryErrorAt: new Date(),
                ack: -1
            });

        } else if (status === 'sent') {
            await message.update({ ack: 1 });
        } else if (status === 'delivered') {
            await message.update({ ack: 2 });
        } else if (status === 'read') {
            await message.update({ ack: 3, read: true });
        }
    }

    private reconnect(): void {
        if (this.connection) {
            this.connection.removeAllListeners();
            this.connection = null;
        }
        this.channel = null;

        logger.info("[RabbitMQ] Reconnecting in 5 seconds...");
        setTimeout(() => this.connect(), 5000);
    }
}

export const rabbitMQListener = new RabbitMQListener();
