import { Module } from '@nestjs/common';
import { SendMessageWhatsappService } from './send-message-whatsapp.service';
import { SendMessageWhatsappController } from './send-message-whatsapp.controller';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { RabbitMQService } from 'src/@core/infra/rabbitmq/RabbitMq.service';

@Module({
  controllers: [SendMessageWhatsappController],
  providers: [
    SendMessageWhatsappService,
    MetaService,
    WhatsappOficialService,
    RabbitMQService,
  ],
})
export class SendMessageWhatsappModule {}
