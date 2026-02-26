import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { generateVCard, IMessageReceived } from "./ReceivedWhatsApp";

const getTimestampMessage = (msgTimestamp: any) => {
    return msgTimestamp * 1
}

const verifyMessageOficial = async (
    message: IMessageReceived,
    ticket: Ticket,
    contact: Contact,
    companyId: number,
    fileName: string,
    fromNumber: string,
    data: any,
    quoteMessageId?: string
) => {

    console.log(`[VerifyMessageOficial] ===== INÍCIO DO PROCESSAMENTO =====`);
    console.log(`[VerifyMessageOficial] Ticket: ${ticket.id}, Type: ${message.type}, FileName: ${fileName}`);

    let bodyMessage: any = message.text;

    if (message.type === "contacts" && Array.isArray(data?.message?.text?.contacts)) {
        const contact = data?.message?.text?.contacts[0];
        bodyMessage = await generateVCard(contact);
    }

    let quotedMsgId = null;

    if (quoteMessageId) {
        const quotedMessage = await Message.findOne({
            where: {
                wid: quoteMessageId,
                companyId: companyId
            }
        });
        quotedMsgId = quotedMessage?.id || null;
    }

    // ✅ CORREÇÃO: Melhor tratamento do body da mensagem para preservar histórico
    let messageBody = '';

    if (message.type === "contacts") {
        messageBody = bodyMessage;
        console.log(`[VERIFY MESSAGE OFICIAL] 👤 Contato: ${messageBody.substring(0, 50)}...`);
    } else {
        // Prioridade: message.text, depois extrair do data, fallback baseado no tipo
        messageBody = message.text ||
            data?.message?.text?.body ||
            data?.message?.conversation ||
            data?.text ||
            (message.type && message.type !== 'text' ? `📎 ${message.type}` : '');

        console.log(`[VERIFY MESSAGE OFICIAL] 💬 Msg ID: ${message.idMessage}, Type: ${message.type}, Body: "${messageBody}"`);

        // Debug adicional quando body está vazio
        if (!messageBody) {
            console.log(`[VERIFY MESSAGE OFICIAL] ⚠️ Body vazio - Debug data:`, {
                messageText: message.text,
                dataMessageTextBody: data?.message?.text?.body,
                dataMessageConversation: data?.message?.conversation,
                dataText: data?.text,
                messageType: message.type
            });
        }
    }

    const messageData = {
        wid: message.idMessage,
        ticketId: ticket.id,
        contactId: contact.id,
        body: messageBody,
        fromMe: false,
        mediaType: message.type === "contacts" ? "contactMessage" : data.message.type,
        mediaUrl: fileName,
        read: false,
        quotedMsgId: quotedMsgId,
        ack: 0,
        channel: 'whatsapp_oficial',
        remoteJid: `${fromNumber}@s.whatsapp.net`,
        participant: null,
        // Evita persistir payloads gigantes (ex.: base64 de mídia) no dataJson.
        // Mantemos apenas um snapshot leve para rastreabilidade.
        dataJson: JSON.stringify({
            fromNumber: data?.fromNumber || fromNumber,
            nameContact: data?.nameContact || null,
            companyId: data?.companyId || companyId,
            message: {
                type: message.type,
                timestamp: message.timestamp,
                idMessage: message.idMessage,
                idFile: message.idFile || null,
                mimeType: message.mimeType || null,
                quoteMessageId: quoteMessageId || null,
                hasFile: !!message.file,
                fileSize: message.file ? String(message.file).length : 0
            }
        }),
        ticketTrakingId: null,
        isPrivate: false,
        createdAt: new Date(
            Math.floor(getTimestampMessage(message.timestamp) * 1000)
        ).toISOString(),
        ticketImported: null,
        isForwarded: false
    };

    // const io = getIO();

    // io.of(String(ticket.companyId))
    //     .emit(`company-${ticket.companyId}-appMessage`, {
    //         action: "create",
    //         message: messageData,
    //         ticket: ticket,
    //         contact: ticket.contact
    //     });

    console.log(`[VerifyMessageOficial] Chamando CreateMessageService com dados:`, {
        wid: messageData.wid,
        ticketId: messageData.ticketId,
        mediaType: messageData.mediaType,
        mediaUrl: messageData.mediaUrl,
        bodyLength: messageData.body?.length || 0
    });

    await CreateMessageService({ messageData, companyId: companyId });

    console.log(`[VerifyMessageOficial] ✅ CreateMessageService concluído com sucesso`);
}

export default verifyMessageOficial;
