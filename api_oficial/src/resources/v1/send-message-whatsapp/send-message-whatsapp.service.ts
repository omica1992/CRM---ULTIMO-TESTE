import { Injectable } from '@nestjs/common';
import { CreateSendMessageWhatsappDto } from './dto/create-send-message-whatsapp.dto';
import { BaseService } from 'src/@core/base/base.service';
import { SendMessageWhatsApp } from 'src/@core/domain/entities/sendMessageWhatsApp.entity';
import { AppError } from 'src/@core/infra/errors/app.error';
import { checkPasteFiles, savedFile } from 'src/@core/common/utils/files.utils';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import {
  IBodyReadMessage,
  IMetaMessage,
  IMetaMessageAudio,
  IMetaMessageContacts,
  IMetaMessageDocument,
  IMetaMessageImage,
  IMetaMessageLocation,
  IMetaMessageReaction,
  IMetaMessageSticker,
  IMetaMessageTemplate,
  IMetaMessageText,
  IMetaMessageVideo,
  IMetaMessageinteractive,
} from 'src/@core/infra/meta/interfaces/IMeta.interfaces';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';

@Injectable()
export class SendMessageWhatsappService extends BaseService<SendMessageWhatsApp> {
  constructor(
    private metaService: MetaService,
    private whatsAppService: WhatsappOficialService,
  ) {
    super('sendMessageWhatsApp', SendMessageWhatsappService.name);
  }

  private async createFile(
    file: Express.Multer.File,
    fileName: string,
    empresaId: number,
    conexaoId: number,
  ) {
    try {
      const data = new Date();

      const year = data.getFullYear();
      let month = String(data.getMonth() + 1);
      month = month.length == 1 ? `0${month}` : month;
      const day = data.getDate();
      let path = `${year}-${month}-${day}`;

      checkPasteFiles(path);
      path += `/${empresaId}`;
      checkPasteFiles(path);
      path += `/${conexaoId}`;
      checkPasteFiles(path);

      return await savedFile(file, path, fileName);
    } catch (error: any) {
      this.logger.error(`createMessage - ${error.message}`);
      throw new Error(`Falha ao salvar o arquivo`);
    }
  }

  private async getIdMetaMedia(
    whatsId: number,
    phone_number_id: string,
    token: string,
    idCompany: number,
    file: Express.Multer.File,
    fileName: string,
  ) {
    try {
      if (!file) throw new Error('Necessário informar um arquivo');

      const pathFile = await this.createFile(
        file,
        fileName,
        idCompany,
        whatsId,
      );

      const metaFile = await this.metaService.sendFileToMeta(
        phone_number_id,
        token,
        pathFile,
      );

      return { pathFile, mediaMetaId: metaFile.id };
    } catch (error: any) {
      this.logger.error(`getIdMetaMedia - ${error.message}`);
      throw new Error(error.message);
    }
  }

  async createMessage(
    token: string,
    dados_mensagem: string,
    file: Express.Multer.File,
  ) {
    try {
      console.log('🔍 [API_OFICIAL DEBUG] Received message data:', dados_mensagem);
      const data: CreateSendMessageWhatsappDto = JSON.parse(dados_mensagem);
      console.log('🔍 [API_OFICIAL DEBUG] Parsed object:', JSON.stringify(data, null, 2));

      if (!data.to)
        throw new Error('Necessário informar o número do destinatario');

      // Aceita número com caracteres de formatação no payload e normaliza para envio.
      const normalizedTo = String(data.to).replace(/\D/g, '');
      const regex = /^\d{8,15}$/;
      if (!regex.test(normalizedTo))
        throw new Error('o número não está no padrão do whatsapp');

      const whats = await this.prisma.whatsappOficial.findFirst({
        where: { token_mult100: token },
      });

      if (!whats) throw new Error('Conexão não encontrada');

      const company = await this.prisma.company.findFirst({
        where: { id: whats.companyId },
      });

      if (!company)
        throw new Error('Nenhuma empresa cadastrada para este usuário');

      const entity: SendMessageWhatsApp = {
        type: data.type,
        whatsappOficialId: whats.id,
        to: normalizedTo,
      };

      const {
        body_text,
        body_video,
        body_document,
        body_image,
        body_location,
        body_reaction,
        body_contacts,
        body_interactive,
        body_sticket,
        body_template,
      } = data;

      // Compatibilidade retroativa:
      // alguns fluxos antigos enviam payload no formato da Meta (text/template/etc)
      // em vez de body_text/body_template.
      const legacyData = data as any;
      const textPayload = body_text ?? legacyData?.text;
      const templatePayload = body_template ?? legacyData?.template;
      const videoPayload = body_video ?? legacyData?.video;
      const documentPayload = body_document ?? legacyData?.document;
      const imagePayload = body_image ?? legacyData?.image;
      const locationPayload = body_location ?? legacyData?.location;
      const reactionPayload = body_reaction ?? legacyData?.reaction;
      const contactsPayload = body_contacts ?? legacyData?.contacts;
      const interactivePayload = body_interactive ?? legacyData?.interactive;
      const stickerPayload = body_sticket ?? legacyData?.sticker;

      let resMedia: { pathFile: string; mediaMetaId: string };
      let dataMessage: any;

      switch (data.type) {
        case 'text':
          if (!textPayload?.body)
            throw new Error(
              'Necessário informar um texto para enviar a mensagem',
            );

          entity.text = {
            body: textPayload.body,
            preview_url: textPayload?.preview_url,
          };
          dataMessage = textPayload;
          break;
        case 'audio':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName,
          );
          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.audio = { id: resMedia.mediaMetaId };
          dataMessage = { id: resMedia.mediaMetaId } as IMetaMessageAudio;
          break;
        case 'video':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName,
          );
          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.video = {
            id: resMedia.mediaMetaId,
            caption: !!videoPayload?.caption ? videoPayload.caption : null,
          };

          dataMessage = {
            id: resMedia.mediaMetaId,
            caption: !!videoPayload?.caption ? videoPayload.caption : null,
          } as IMetaMessageVideo;
          break;
        case 'document':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName,
          );
          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.document = {
            filename: resMedia.pathFile,
            id: resMedia.mediaMetaId,
            caption: !!documentPayload?.caption ? documentPayload.caption : null,
          };

          dataMessage = {
            filename: resMedia.pathFile,
            id: resMedia.mediaMetaId,
            caption: !!documentPayload?.caption ? documentPayload.caption : null,
          } as IMetaMessageDocument;
          break;
        case 'image':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName,
          );
          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.image = {
            id: resMedia.mediaMetaId,
            caption: !!imagePayload?.caption ? imagePayload.caption : null,
          };

          dataMessage = {
            id: resMedia.mediaMetaId,
            caption: !!imagePayload?.caption ? imagePayload.caption : null,
          } as IMetaMessageImage;
          break;
        case 'location':
          if (!locationPayload?.latitude && !locationPayload?.longitude)
            throw new Error('Necessário informar a latitude e longitude');

          entity.location = {
            latitude: locationPayload.latitude,
            longitude: locationPayload.longitude,
            name: !!locationPayload?.name ? locationPayload.name : null,
            address: !!locationPayload?.address ? locationPayload.address : null,
          };

          dataMessage = {
            latitude: locationPayload.latitude,
            longitude: locationPayload.longitude,
            name: !!locationPayload?.name ? locationPayload.name : null,
            address: !!locationPayload?.address ? locationPayload.address : null,
          } as IMetaMessageLocation;
          break;
        case 'reaction':
          if (!reactionPayload?.message_id || !reactionPayload?.emoji)
            throw new Error('Necessário informar o id da mensagem e o emoji');

          entity.reaction = {
            message_id: reactionPayload.message_id,
            emoji: reactionPayload.emoji,
          };

          dataMessage = {
            message_id: reactionPayload.message_id,
            emoji: reactionPayload.emoji,
          };
          break;
        case 'contacts':
          entity.contacts = [contactsPayload] as any;

          dataMessage = [contactsPayload];
          break;
        case 'interactive':
          console.log(JSON.stringify(interactivePayload, null, 2));
          if (
            interactivePayload?.type == 'button' ||
            interactivePayload?.type == 'list'
          ) {
            entity.interactive = interactivePayload as any;

            dataMessage = interactivePayload;
          } else {
            throw new Error('O tipo de mensagem esta incorreto');
          }
          break;
        case 'sticker':
          if (!stickerPayload?.id)
            throw new Error('Necessário informar o id do sticker');

          entity.sticker = { id: stickerPayload.id };

          dataMessage = { id: stickerPayload.id } as IMetaMessageSticker;
          break;
        case 'template':
          if (!templatePayload?.name)
            throw new Error('Necessário informar o template para enviar a mensagem');

          entity.template = templatePayload as any;

          dataMessage = templatePayload;
          break;
        default:
          throw new Error('Este tipo não é suportado pela meta');
      }

      const message: IMetaMessage = {
        to: normalizedTo,
        type: data.type,
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...(data.quotedId && { context: { message_id: data.quotedId } }),
      };

      message[data.type] = dataMessage;

      const res = await this.metaService.sendMessage(
        whats.phone_number_id,
        whats.send_token,
        message,
      );

      entity.idMessageWhatsApp = res.messages.map((m) => m.id);

      return await this.prisma.sendMessageWhatsApp.create({ data: entity });
    } catch (error: any) {
      this.logger.error(`createMessage - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async readMessage(token: string, messageId: string) {
    try {
      const body = {
        message_id: messageId,
        messaging_product: 'whatsapp',
        status: 'read',
      } as IBodyReadMessage;

      const whats =
        await this.whatsAppService.prisma.whatsappOficial.findUnique({
          where: { token_mult100: token },
        });

      if (!whats) throw new Error('Nenhum número configurado para este token');

      return await this.metaService.sendReadMessage(
        whats.phone_number_id,
        whats.send_token,
        body,
      );
    } catch (error: any) {
      this.logger.error(`readMessage - ${error.message}`);
      throw new AppError(error.message);
    }
  }
}
