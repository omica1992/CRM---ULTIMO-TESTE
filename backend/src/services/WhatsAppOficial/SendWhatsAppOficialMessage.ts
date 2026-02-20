import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { isNil } from "lodash";
import { sendMessageWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import { IMetaMessageTemplate, IMetaMessageinteractive, IReturnMessageMeta, ISendMessageOficial } from "../../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import CreateMessageService from "../MessageServices/CreateMessageService";
import SafeCreateMessage from "../../helpers/SafeCreateMessage";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";
import { normalizePhoneNumber, isValidWhatsAppNumber } from "../../helpers/PhoneNumberHelper";

interface Request {
  body: string;
  ticket: Ticket;
  type: 'text' | 'reaction' | 'audio' | 'document' | 'image' | 'sticker' | 'video' | 'location' | 'contacts' | 'interactive' | 'template',
  quotedMsg?: Message;
  msdelay?: number;
  media?: Express.Multer.File,
  vCard?: Contact;
  template?: IMetaMessageTemplate,
  interative?: IMetaMessageinteractive,
  bodyToSave?: string
}

const getTypeMessage = (type: string): 'text' | 'reaction' | 'audio' | 'document' | 'image' | 'sticker' | 'video' | 'location' | 'contacts' | 'interactive' | 'template' => {
  console.log("type", type);
  switch (type) {
    case 'video':
      return 'video';
    case 'audio':
      return 'audio';
    case 'image':
      return 'image'
    case 'application':
      return 'document'
    case 'document':
      return 'document'
    case 'text':
      return 'document'
    case 'interactive':
      return 'interactive'
    case 'contacts':
      return 'contacts'
    case 'location':
      return 'location'
    case 'template':
      return 'template'
    case 'reaction':
      return 'reaction'
    default:
      return null
  }
}

const SendWhatsAppOficialMessage = async ({
  body,
  ticket,
  media,
  type,
  vCard,
  template,
  interative,
  quotedMsg,
  bodyToSave
}: Request): Promise<IReturnMessageMeta> => {

  // ✅ CORREÇÃO: Garantir que ticket.whatsapp está carregado
  if (!ticket.whatsapp) {
    const Whatsapp = (await import("../../models/Whatsapp")).default;
    ticket.whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

    if (!ticket.whatsapp) {
      logger.error(`[SEND WHATSAPP OFICIAL] Whatsapp ${ticket.whatsappId} não encontrado para ticket ${ticket.id}`);
      throw new AppError("ERR_WHATSAPP_NOT_FOUND");
    }
  }

  const pathMedia = !!media ? media.path : null;
  let options: ISendMessageOficial = {} as ISendMessageOficial;
  const typeMessage = !!media ? media.mimetype.split("/")[0] : null;
  let bodyTicket = "";
  let mediaType: string;

  const bodyMsg = body ? formatBody(body, ticket) : null;

  type = !type ? getTypeMessage(typeMessage) : type;

  switch (type) {
    case 'video':
      options.body_video = { caption: bodyMsg };
      options.type = 'video';
      options.fileName = media.originalname.replace('/', '-');
      bodyTicket = "🎥 Arquivo de vídeo";
      mediaType = 'video';
      break;
    case 'audio':
      options.type = 'audio';
      options.fileName = media.originalname.replace('/', '-');
      bodyTicket = "🎵 Arquivo de áudio";
      mediaType = 'audio';
      break;
    case 'document':
      options.type = 'document';
      options.body_document = { caption: bodyMsg };
      options.fileName = media.originalname.replace('/', '-');
      bodyTicket = "📂 Arquivo de Documento";
      mediaType = 'document';
      break;
    case 'image':
      options.type = 'image';
      options.body_image = { caption: bodyMsg };
      options.fileName = media.originalname.replace('/', '-');
      bodyTicket = "📷 Arquivo de Imagem";
      mediaType = 'image';
      break;
    case 'text':
      options.type = 'text';
      options.body_text = { body: bodyMsg };
      mediaType = 'conversation';
      break;
    case 'interactive':
      options.type = 'interactive';
      mediaType = interative.type == 'button' ? 'interative' : 'listMessage';
      options.body_interactive = interative;
      break;
    case 'contacts':
      options.type = 'contacts';
      mediaType = 'contactMessage';
      const first_name = vCard?.name?.split(' ')[0];
      const last_name = String(vCard?.name).replace(vCard?.name?.split(' ')[0], '');
      options.body_contacts = {
        name: { first_name: first_name, last_name: last_name, formatted_name: `${first_name} ${last_name}`.trim() },
        phones: [{ phone: `+${vCard?.number}`, wa_id: +vCard?.number, type: 'CELL' }],
        emails: [{ email: vCard?.email }]
      }
      break;
    case 'location':
      throw new Error(`Tipo ${type} não configurado para enviar mensagem a Meta`);
    case 'template':
      options.type = 'template';
      // ✅ Processamento de variáveis no template
      if (!ticket.contact) {
        const ContactModel = (await import("../../models/Contact")).default;
        ticket.contact = await ContactModel.findByPk(ticket.contactId);
      }

      if (template && template.components) {
        const componentsList: any[] = Array.isArray(template.components)
          ? template.components
          : [template.components];

        componentsList.forEach((component) => {
          if (component.parameters) {
            const parametersList: any[] = Array.isArray(component.parameters)
              ? component.parameters
              : [component.parameters];

            parametersList.forEach((parameter) => {
              if (parameter.type === 'text' && parameter.text) {
                // Tenta substituir variáveis via Mustache primeiro
                let formattedText = formatBody(parameter.text, ticket);

                // Fallback manual se o Mustache retornar vazio para variáveis conhecidas,
                // ou se o formato vier quebrado no req.body
                if (!formattedText || formattedText.trim() === '') {
                  const originalText = parameter.text;

                  // Regex para preencher hardcoded se o Mustache falhar por falta de referência
                  formattedText = originalText
                    .replace(/\{\{\s*name\s*\}\}/g, ticket.contact?.name || "")
                    .replace(/\{\{\s*firstName\s*\}\}/g, ticket.contact?.name ? ticket.contact.name.split(' ')[0] : "")
                    .replace(/\{\{\s*ticket_id\s*\}\}/g, ticket.id?.toString() || "");
                }

                parameter.text = formattedText;
              }
            });
          }
        });
      }
      options.body_template = template;
      mediaType = 'template';
      break;
    case 'reaction':
      throw new Error(`Tipo ${type} não configurado para enviar mensagem a Meta`)
    default:
      throw new Error(`Tipo ${type} não configurado para enviar mensagem a Meta`);
  }

  const contact = await Contact.findByPk(ticket.contactId)

  let vcard;

  if (!isNil(vCard)) {
    console.log(vCard)
    const numberContact = vCard.number;
    const firstName = vCard.name.split(' ')[0];
    const lastName = String(vCard.name).replace(vCard.name.split(' ')[0], '')
    const normalizedVCardNumber = normalizePhoneNumber(numberContact);
    vcard = `BEGIN:VCARD\n`
      + `VERSION:3.0\n`
      + `N:${lastName};${firstName};;;\n`
      + `FN:${vCard.name}\n`
      + `TEL;type=CELL;waid=${numberContact}:+${normalizedVCardNumber}\n`
      + `END:VCARD`;
    console.log(vcard)
  }

  // ✅ CORREÇÃO: Normalizar número do contato antes de enviar
  const normalizedNumber = normalizePhoneNumber(contact.number);

  // Validar se o número está no formato correto
  if (!isValidWhatsAppNumber(normalizedNumber)) {
    logger.error(`[WHATSAPP OFICIAL - ERROR] Número inválido - Ticket: ${ticket.id}, Número: ${contact.number}, Normalizado: ${normalizedNumber}`);
    throw new AppError("ERR_INVALID_PHONE_NUMBER");
  }

  logger.info(`[WHATSAPP OFICIAL - SEND] Número normalizado - Original: ${contact.number}, Normalizado: ${normalizedNumber}`);

  options.to = normalizedNumber;
  options.type = type;
  options.quotedId = quotedMsg?.wid;

  let sendMessage: IReturnMessageMeta | null = null;
  let messageData: any = null;

  try {
    // ✅ PASSO 1: Enviar mensagem via API Oficial
    sendMessage = await sendMessageWhatsAppOficial(
      pathMedia,
      ticket.whatsapp.token,
      options
    )

    logger.info(`[WHATSAPP OFICIAL - SEND] ✅ Mensagem enviada via API - Ticket: ${ticket.id}`);

    await ticket.update({ lastMessage: !bodyMsg && !!media ? bodyTicket : bodyMsg, imported: null, unreadMessages: 0 });

    const wid: any = sendMessage

    const bodyMessage = !isNil(vCard) ? vcard : !bodyMsg ? '' : bodyMsg;
    messageData = {
      wid: wid?.idMessageWhatsApp[0],
      ticketId: ticket.id,
      contactId: contact.id,
      body: type === 'interactive' ? bodyToSave : bodyMessage,
      fromMe: true,
      mediaType: mediaType,
      mediaUrl: !!media ? media.filename : null,
      read: true,
      quotedMsgId: quotedMsg?.id || null,
      ack: 2,
      channel: 'whatsapp_oficial',
      remoteJid: `${contact.number}@s.whatsapp.net`,
      participant: null,
      dataJson: JSON.stringify(body),
      ticketTrakingId: null,
      isPrivate: false,
      createdAt: new Date().toISOString(),
      ticketImported: ticket.imported,
      isForwarded: false,
      originalName: !!media ? media.filename : null
    };

    // ✅ PASSO 2: Salvar mensagem no banco com retry
    logger.info(`[WHATSAPP OFICIAL - SAVE] Salvando mensagem no banco - Ticket: ${ticket.id}`);

    const savedMessage = await SafeCreateMessage({
      messageData,
      companyId: ticket.companyId,
      maxRetries: 3,
      context: `SEND_OFICIAL_${ticket.id}`
    });

    if (savedMessage) {
      logger.info(`[WHATSAPP OFICIAL - SAVE] ✅ Mensagem salva com sucesso - Ticket: ${ticket.id}`);
    } else {
      logger.error(`[WHATSAPP OFICIAL - SAVE] ❌ CRÍTICO: Mensagem enviada mas NÃO foi salva - Ticket: ${ticket.id}, WID: ${messageData.wid}`);
      // ⚠️ Mensagem foi enviada mas não foi salva - registrado em arquivo para recuperação
    }

    return sendMessage;

  } catch (err) {
    logger.error(`[WHATSAPP OFICIAL - ERROR] Erro ao enviar mensagem - Company: ${ticket.companyId}, Ticket: ${ticket.id}`, err);

    // ✅ Se mensagem foi enviada mas erro aconteceu depois, tentar salvar
    if (sendMessage && messageData) {
      logger.warn(`[WHATSAPP OFICIAL - RECOVERY] Tentando salvar mensagem que foi enviada mas teve erro no processamento`);

      await SafeCreateMessage({
        messageData,
        companyId: ticket.companyId,
        maxRetries: 5, // Mais tentativas pois mensagem JÁ foi enviada
        context: `RECOVERY_OFICIAL_${ticket.id}`
      });
    }

    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }

}

export default SendWhatsAppOficialMessage;
