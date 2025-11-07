import path from "path";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import moment from "moment";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import verifyMessageOficial from "./VerifyMessageOficial";
import verifyQueueOficial from "./VerifyQueue";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { handleMessageIntegration } from "../WbotServices/wbotMessageListener";
import { flowbuilderIntegration } from "../WbotServices/wbotMessageListener";
import ShowContactService from "../ContactServices/ShowContactService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { WebhookModel } from "../../models/Webhook";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import cacheLayer from "../../libs/cache";
import { isNil } from "lodash";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppOficialMessage from "./SendWhatsAppOficialMessage";
import flowBuilderQueue from "../WebhookService/flowBuilderQueue";

const mimeToExtension: { [key: string]: string } = {
    'audio/aac': 'aac',
    'application/x-abiword': 'abw',
    'application/octet-stream': 'arc',
    'video/x-msvideo': 'avi',
    'application/vnd.amazon.ebook': 'azw',
    'application/x-bzip': 'bz',
    'application/x-bzip2': 'bz2',
    'application/x-csh': 'csh',
    'text/css': 'css',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.ms-fontobject': 'eot',
    'application/epub+zip': 'epub',
    'image/gif': 'gif',
    'text/html': 'html',
    'image/x-icon': 'ico',
    'text/calendar': 'ics',
    'image/jpeg': 'jpg',
    'application/json': 'json',
    'audio/midi': 'midi',
    'video/mpeg': 'mpeg',
    'application/vnd.apple.installer+xml': 'mpkg',
    'audio/ogg': 'oga',
    'video/ogg': 'ogv',
    'application/ogg': 'ogx',
    'font/otf': 'otf',
    'image/png': 'png',
    'application/pdf': 'pdf',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/x-rar-compressed': 'rar',
    'application/rtf': 'rtf',
    'application/x-sh': 'sh',
    'image/svg+xml': 'svg',
    'application/x-shockwave-flash': 'swf',
    'image/tiff': 'tiff',
    'application/typescript': 'ts',
    'font/ttf': 'ttf',
    'application/vnd.visio': 'vsd',
    'audio/x-wav': 'wav',
    'audio/webm': 'weba',
    'video/webm': 'webm',
    'image/webp': 'webp',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'application/xhtml+xml': 'xhtml',
    'application/xml': 'xml',
    'video/3gpp': '3gp',
    'audio/3gpp': '3gp',
    'video/3gpp2': '3g2',
    'audio/3gpp2': '3g2',
    'application/x-msdownload': 'exe',
    'application/x-executable': 'exe',
};

export interface IReceivedWhatsppOficial {
    token: string;
    fromNumber: string;
    nameContact: string;
    companyId: number;
    message: IMessageReceived;
}

export interface IReceivedReadWhatsppOficialRead {
    messageId: string;
    companyId: number;
    token: string;
}

export interface IMessageReceived {
    type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'location' | 'contacts' | 'sticker' | 'order' | 'reaction' | 'interactive';
    timestamp: number;
    idMessage: string;
    idFile?: string;
    text?: string;
    file?: string;
    mimeType?: string;
    quoteMessageId?: string;
}

export async function generateVCard(contact: any): Promise<string> {
    const firstName = contact?.name?.first_name || contact?.name?.formatted_name?.split(' ')[0];
    const lastName = String(contact?.name?.formatted_name).replace(firstName, '')
    const formattedName = contact?.name?.formatted_name || '';
    const phoneEntries = contact?.phones?.map((phone: any) => {
        const phoneNumber = phone?.phone || '';
        const waId = phone?.wa_id || '';
        const phoneType = phone?.type || 'CELL';
        return `TEL;type=${phoneType};waid=${waId}:+${phoneNumber}\n`;
    });

    const vcard = `BEGIN:VCARD\n`
        + `VERSION:3.0\n`
        + `N:${lastName};${firstName};;;\n`
        + `FN:${formattedName}\n`
        + `${phoneEntries}`
        + `END:VCARD`;
    return vcard;
}

// ✅ FUNÇÃO ADAPTADA DO SAYCHATBOT PARA API OFICIAL
export const sayChatbotOficial = async (
    queueId: number,
    ticket: Ticket,
    contact: Contact,
    msg: any,
    ticketTraking: any,
    companyId: number
): Promise<any> => {
    try {
        console.log("[WHATSAPP OFICIAL] sayChatbotOficial iniciado para ticket", ticket.id);

        // Buscar a fila
        const queue = await Queue.findByPk(queueId);
        if (!queue) {
            console.error("[WHATSAPP OFICIAL] Fila não encontrada:", queueId);
            return;
        }

        // Verificar se tem chatbots configurados
        if (!queue.chatbots || queue.chatbots.length === 0) {
            console.log("[WHATSAPP OFICIAL] Fila sem chatbots configurados");
            return;
        }

        // Verificar se é primeira mensagem ou se já tem opção selecionada
        const selectedOption = msg?.message?.buttonsResponseMessage?.selectedButtonId ||
            msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg?.message?.conversation;

        if (!selectedOption) {
            console.log("[WHATSAPP OFICIAL] Nenhuma opção selecionada");
            return;
        }

        // Se for primeira mensagem, mostrar opções das filas
        if (ticket.status === "pending" && !ticket.queueId) {
            let options = "";
            const queues = await Queue.findAll({
                where: { companyId },
                include: [{ model: User, as: "users" }]
            });

            queues.forEach((q, index) => {
                options += `*[ ${index + 1} ]* - ${q.name}\n`;
            });
            options += `\n*[ Sair ]* - Encerrar atendimento`;

            const greetingMessage = "Bem-vindo! Escolha uma opção:";
            const body = `${greetingMessage}\n\n${options}`;

            // Enviar mensagem via API oficial (simulado)
            console.log("[WHATSAPP OFICIAL] Enviando mensagem de boas-vindas:", body);

            // Atualizar ticket com a mensagem
            await ticket.update({ lastMessage: body });

            return;
        }

        // Se já tem fila selecionada, processar chatbot
        if (ticket.queueId && queue.chatbots.length > 0) {
            if (selectedOption.toLowerCase() === "sair") {
                // Encerrar atendimento
                await ticket.update({
                    isBot: false,
                    status: "closed",
                    maxUseBotQueues: 0
                });

                await ticketTraking.update({
                    closedAt: moment().toDate(),
                    finishedAt: moment().toDate()
                });

                const complationMessage = "Atendimento encerrado. Obrigado!";
                console.log("[WHATSAPP OFICIAL] Encerrando atendimento:", complationMessage);

                await ticket.update({ lastMessage: complationMessage });
                return;
            }

            // Processar opção selecionada
            const numericOption = parseInt(selectedOption);
            if (!isNaN(numericOption) && numericOption > 0 && numericOption <= queue.chatbots.length) {
                const selectedChatbot = queue.chatbots[numericOption - 1];

                if (selectedChatbot.greetingMessage) {
                    console.log("[WHATSAPP OFICIAL] Enviando mensagem do chatbot:", selectedChatbot.greetingMessage);
                    await ticket.update({ lastMessage: selectedChatbot.greetingMessage });
                }

                // Atualizar ticket com o chatbot selecionado
                await ticket.update({
                    queueId: queue.id,
                    isBot: true
                });
            }
        }

        console.log("[WHATSAPP OFICIAL] sayChatbotOficial concluído para ticket", ticket.id);

    } catch (error) {
        console.error("[WHATSAPP OFICIAL] Erro em sayChatbotOficial:", error);
        logger.error(`[WHATSAPP OFICIAL] Erro sayChatbotOficial: ${error}`);
    }
};

export class ReceibedWhatsAppService {

    constructor() { }

    async getMessage(data: IReceivedWhatsppOficial) {
        let campaignExecuted = false;
        
        try {
            const { message, fromNumber, nameContact, token } = data;

            const conexao = await Whatsapp.findOne({ where: { token } });

            const { companyId } = conexao;

            if (!conexao) {
                logger.error('getMessage - Nenhum whatsApp encontrado');
                return;
            }

            const whatsapp = await ShowWhatsAppService(conexao.id, companyId);

            // ✅ USAR CreateOrUpdateContactService para manter consistência com Baileys
            let contact = await Contact.findOne({ where: { number: fromNumber, companyId } });

            if (!contact) {
                // Preparar dados do contato com todos os campos necessários
                const contactData = {
                    name: nameContact || fromNumber,
                    number: fromNumber,
                    profilePicUrl: "",
                    isGroup: false,
                    email: "",
                    empresa: "",
                    cpf: "",
                    birthDate: null,
                    channel: "whatsapp_oficial",
                    companyId,
                    extraInfo: [],
                    remoteJid: `${fromNumber}@s.whatsapp.net`,
                    lid: null,
                    whatsappId: whatsapp.id,
                    wbot: null // API Oficial não tem wbot
                };

                contact = await CreateOrUpdateContactService(contactData);
                logger.info(`[WhatsApp Oficial] Novo contato criado: ${contact.id} - ${fromNumber}`);
            } else {
                // Atualizar contato se necessário
                if (!contact.channel || contact.channel !== "whatsapp_oficial") {
                    await contact.update({ channel: "whatsapp_oficial", whatsappId: whatsapp.id });
                }
            }

            let fileName;

            const { file, mimeType, idFile, type, quoteMessageId } = message;

            if (!!file) {

                const base64Data = file.replace(/^data:image\/\w+;base64,/, '');

                const buffer = Buffer.from(base64Data, 'base64');

                fileName = `${idFile}.${mimeToExtension[mimeType]}`;

                const folder = path.resolve(__dirname, "..", "..", "..", "public", `company${companyId}`);

                // const folder = `public/company${companyId}`; // Correção adicionada por Altemir 16-08-2023
                if (!existsSync(folder)) {
                    mkdirSync(folder, { recursive: true }); // Correção adicionada por Altemir 16-08-2023
                    chmodSync(folder, 0o777)
                }

                writeFileSync(`${folder}/${fileName}`, buffer, { encoding: 'base64' });
            }
            const settings = await CompaniesSettings.findOne({
                where: { companyId }
            });

            const ticket = await FindOrCreateTicketService(
                contact,
                whatsapp,
                0,
                companyId,
                null,
                null,
                null,
                'whatsapp_oficial',
                false,
                false,
                settings
            );

            const ticketTraking = await FindOrCreateATicketTrakingService({
                ticketId: ticket.id,
                companyId,
                userId: null,
                whatsappId: whatsapp.id
            });

            await ticket.update({ lastMessage: message.type === "contacts" ? "Contato" : !!message?.text ? message?.text : '', unreadMessages: ticket.unreadMessages + 1 })

            await verifyMessageOficial(message, ticket, contact, companyId, fileName, fromNumber, data, quoteMessageId);

            // ✅ TRATATIVA PARA HORÁRIO DE EXPEDIENTE DA EMPRESA/CONEXÃO
            let currentSchedule;

            if (settings.scheduleType === "company") {
                currentSchedule = await VerifyCurrentSchedule(companyId, 0, 0);
            } else if (settings.scheduleType === "connection") {
                currentSchedule = await VerifyCurrentSchedule(companyId, 0, whatsapp.id);
            }

            // Verifica se está fora do expediente (company ou connection)
            if (
                settings.scheduleType &&
                (settings.scheduleType === "company" || settings.scheduleType === "connection") &&
                !isNil(currentSchedule) &&
                (!currentSchedule || currentSchedule.inActivity === false) &&
                (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
                !["open", "group"].includes(ticket.status)
            ) {
                logger.info(`[WHATSAPP OFICIAL - OUT OF HOURS] Ticket ${ticket.id} fora de expediente (${settings.scheduleType})`);

                // Verificar limite de uso do bot
                if (
                    whatsapp.maxUseBotQueues &&
                    whatsapp.maxUseBotQueues !== 0 &&
                    ticket.amountUsedBotQueues >= whatsapp.maxUseBotQueues
                ) {
                    logger.info(`[WHATSAPP OFICIAL - OUT OF HOURS] Ticket ${ticket.id} atingiu limite de uso do bot`);
                    return;
                }

                // Controle de tempo de reenvio
                if (whatsapp.timeUseBotQueues && whatsapp.timeUseBotQueues !== "0") {
                    if (ticket.isOutOfHour === false && ticketTraking.chatbotAt !== null) {
                        await ticketTraking.update({ chatbotAt: null });
                        await ticket.update({ amountUsedBotQueues: 0 });
                    }

                    const dataLimite = new Date();
                    const Agora = new Date();

                    if (ticketTraking.chatbotAt !== null) {
                        dataLimite.setMinutes(
                            ticketTraking.chatbotAt.getMinutes() + Number(whatsapp.timeUseBotQueues)
                        );

                        if (
                            ticketTraking.chatbotAt !== null &&
                            Agora < dataLimite &&
                            whatsapp.timeUseBotQueues !== "0" &&
                            ticket.amountUsedBotQueues !== 0
                        ) {
                            logger.info(`[WHATSAPP OFICIAL - OUT OF HOURS] Ticket ${ticket.id} ainda em período de espera`);
                            return;
                        }
                    }

                    await ticketTraking.update({ chatbotAt: null });
                }

                // Enviar mensagem de fora de expediente
                if (whatsapp.outOfHoursMessage !== "" && !ticket.imported) {
                    logger.info(`[WHATSAPP OFICIAL - OUT OF HOURS] Enviando mensagem de fora de expediente para ticket ${ticket.id}`);
                    const body = formatBody(`${whatsapp.outOfHoursMessage}`, ticket);

                    await SendWhatsAppOficialMessage({
                        body,
                        ticket,
                        quotedMsg: null,
                        type: 'text',
                        media: null,
                        vCard: null
                    });
                }

                // Atualizar ticket
                await ticket.update({
                    amountUsedBotQueues: ticket.amountUsedBotQueues + 1,
                    isOutOfHour: true
                });

                await ticketTraking.update({
                    chatbotAt: moment().toDate()
                });

                logger.info(`[WHATSAPP OFICIAL - OUT OF HOURS] Processamento concluído para ticket ${ticket.id}`);
                return;
            }

            logger.info(`[WHATSAPP OFICIAL - DEBUG] *** CHEGOU NA VERIFICAÇÃO DE FILA - ticket ${ticket.id} ***`);
            logger.info(`[WHATSAPP OFICIAL - DEBUG] Verificando condições para verifyQueue - ticket ${ticket.id}:`);
            logger.info(`[WHATSAPP OFICIAL - DEBUG] - imported: ${ticket.imported}, queue: ${!!ticket.queue}, isGroup: ${ticket.isGroup}, userId: ${ticket.userId}, queues.length: ${whatsapp?.queues?.length}, useIntegration: ${ticket.useIntegration}`);
            
            if (
                !ticket.imported &&
                !ticket.queue &&
                (!ticket.isGroup || whatsapp.groupAsTicket === "enabled") &&
                !ticket.userId &&
                whatsapp?.queues?.length >= 1 &&
                !ticket.useIntegration
            ) {
                // console.log("antes do verifyqueue")
                logger.info(`[WHATSAPP OFICIAL - DEBUG] Chamando verifyQueueOficial para ticket ${ticket.id}`);
                await verifyQueueOficial(message, ticket, settings, ticketTraking);
                logger.info(`[WHATSAPP OFICIAL - DEBUG] verifyQueueOficial concluído para ticket ${ticket.id}`);

                if (ticketTraking.chatbotAt === null) {
                    await ticketTraking.update({
                        chatbotAt: moment().toDate(),
                    })
                }
            }

            // ✅ IMPLEMENTAÇÃO DO SAYCHATBOT PARA API OFICIAL
            
            // 🔄 TRATATIVA 1: INPUT NODE (flowbuilder) - IGUAL AO BAILEYS
            if (
                (ticket.dataWebhook as any)?.waitingInput === true &&
                (ticket.dataWebhook as any)?.inputVariableName
            ) {
                logger.info(`[WHATSAPP OFICIAL - INPUT NODE] Processando resposta para nó de input - ticket ${ticket.id}`);
                try {
                    const body = message.text || "";
                    const inputVariableName = (ticket.dataWebhook as any).inputVariableName;
                    const inputIdentifier = (ticket.dataWebhook as any).inputIdentifier || `${ticket.id}_${inputVariableName}`;

                    // Salvar resposta nas variáveis globais
                    global.flowVariables = global.flowVariables || {};
                    global.flowVariables[inputVariableName] = body;
                    global.flowVariables[inputIdentifier] = body;

                    const nextNode = global.flowVariables[`${inputIdentifier}_next`];

                    logger.info(`[WHATSAPP OFICIAL - INPUT NODE] Variável salva: ${inputVariableName} = "${body}"`);
                    logger.info(`[WHATSAPP OFICIAL - INPUT NODE] Próximo nó: ${nextNode}`);

                    // Atualizar ticket para remover estado de waiting
                    await ticket.update({
                        dataWebhook: {
                            ...ticket.dataWebhook,
                            waitingInput: false,
                            inputProcessed: true,
                            inputVariableName: null,
                            inputIdentifier: null,
                            lastInputValue: body
                        }
                    });

                    // Continuar fluxo se houver próximo nó
                    if (nextNode && ticket.flowStopped) {
                        const flow = await FlowBuilderModel.findOne({
                            where: { id: ticket.flowStopped, company_id: companyId }
                        });

                        if (flow) {
                            const nodes: any[] = flow.flow["nodes"];
                            const connections: any[] = flow.flow["connections"];

                            const mountDataContact = {
                                number: contact.number,
                                name: contact.name,
                                email: contact.email
                            };

                            logger.info(`[WHATSAPP OFICIAL - INPUT NODE] Continuando fluxo do nó ${nextNode}`);

                            await ActionsWebhookService(
                                whatsapp.id,
                                parseInt(ticket.flowStopped),
                                ticket.companyId,
                                nodes,
                                connections,
                                nextNode,
                                null,
                                "",
                                ticket.hashFlowId || "",
                                null,
                                ticket.id,
                                mountDataContact,
                                true // inputResponded true para node input
                            );

                            logger.info(`[WHATSAPP OFICIAL - INPUT NODE] ✅ Fluxo continuado com sucesso`);
                            return;
                        }
                    }
                } catch (error) {
                    logger.error(`[WHATSAPP OFICIAL - INPUT NODE] ❌ Erro ao processar resposta do nó de input:`, error);
                }
            }

            // 🔄 TRATATIVA 2: RETOMAR FLUXO INTERROMPIDO (flowBuilderQueue) - IGUAL AO BAILEYS
            if (
                ticket.flowStopped &&
                ticket.flowWebhook &&
                ticket.lastFlowId &&
                !isNaN(parseInt(ticket.lastMessage))
            ) {
                logger.info(`[WHATSAPP OFICIAL - FLOW QUEUE] Retomando fluxo interrompido - ticket ${ticket.id}, flow ${ticket.flowStopped}`);
                
                try {
                    // Criar mensagem simulada para compatibilidade com flowBuilderQueue
                    const simulatedMsg = {
                        key: {
                            fromMe: false,
                            remoteJid: `${fromNumber}@s.whatsapp.net`,
                            id: message.idMessage
                        },
                        message: {
                            conversation: message.text || "",
                            timestamp: message.timestamp
                        }
                    } as any;

                    await flowBuilderQueue(
                        ticket,
                        simulatedMsg,
                        null, // wbot é null na API Oficial
                        whatsapp,
                        companyId,
                        contact,
                        null
                    );

                    logger.info(`[WHATSAPP OFICIAL - FLOW QUEUE] ✅ Fluxo interrompido retomado com sucesso`);
                    return; // ✅ CORREÇÃO: Sair após processar fluxo para evitar duplicação
                } catch (error) {
                    logger.error(`[WHATSAPP OFICIAL - FLOW QUEUE] ❌ Erro ao retomar fluxo interrompido:`, error);
                }
            }

            if (
                ticket.queue &&
                ticket.queueId &&
                !ticket.useIntegration &&
                !ticket.integrationId
            ) {
                if (!ticket.user || ticket.queue?.chatbots?.length > 0) {
                    console.log("[WHATSAPP OFICIAL] Executando sayChatbot para ticket", ticket.id);

                    // Criar um objeto msg simulado para compatibilidade com sayChatbot
                    const simulatedMsg = {
                        key: {
                            fromMe: false,
                            remoteJid: `${fromNumber}@s.whatsapp.net`,
                            id: message.idMessage
                        },
                        message: {
                            buttonsResponseMessage: message.type === "interactive" ? { selectedButtonId: message.text } : undefined,
                            listResponseMessage: message.type === "interactive" ? { singleSelectReply: { selectedRowId: message.text } } : undefined,
                            conversation: message.text || "",
                            timestamp: message.timestamp
                        }
                    };

                    try {
                        await sayChatbotOficial(
                            ticket.queueId,
                            ticket,
                            contact,
                            simulatedMsg,
                            ticketTraking,
                            companyId
                        );
                    } catch (error) {
                        console.error("[WHATSAPP OFICIAL] Erro ao executar sayChatbotOficial:", error);
                        logger.error(`[WHATSAPP OFICIAL] Erro sayChatbotOficial: ${error}`);
                    }
                }

                // Atualiza mensagem para indicar que houve atividade e aí contar o tempo novamente para enviar mensagem de inatividade
                await ticket.update({
                    sendInactiveMessage: false
                });
            }

            // ✅ VERIFICAÇÃO DE CAMPANHAS E FLUXOS (mesma lógica do wbotMessageListener)
            if (!ticket.imported && !ticket.isGroup && ticket.isBot !== false) {
                logger.info(`[WHATSAPP OFICIAL - FLOW] 🔍 Iniciando verificação de campanhas para ticket ${ticket.id}`);
                
                // Verificar se ticket.integrationId existe antes de continuar
                if (!ticket.integrationId) {
                    logger.info(`[WHATSAPP OFICIAL - FLOW] ⚠️ Ticket ${ticket.id} sem integração, pulando verificação de campanhas`);
                } else {
                    logger.info(`[WHATSAPP OFICIAL - FLOW] 🔎 Ticket ${ticket.id} possui integrationId, verificando campanhas...`);

                    const contactForCampaign = await ShowContactService(
                        ticket.contactId,
                        ticket.companyId
                    );

                    try {
                        const queueIntegrations = await ShowQueueIntegrationService(
                            ticket.integrationId,
                            companyId
                        );

                        // ✅ EXECUTAR CAMPANHA APENAS UMA VEZ
                        const simulatedMsgForFlow = {
                            key: {
                                fromMe: false,
                                remoteJid: `${fromNumber}@s.whatsapp.net`,
                                id: message.idMessage || `ofc-${Date.now()}`
                            },
                            message: {
                                conversation: message.text || ticket.lastMessage || "",
                                timestamp: message.timestamp || Math.floor(Date.now() / 1000)
                            }
                        } as any;

                        logger.info(`[WHATSAPP OFICIAL - FLOW] 🚀 Chamando flowbuilderIntegration para ticket ${ticket.id}`);
                        
                        try {
                            campaignExecuted = await flowbuilderIntegration(
                                simulatedMsgForFlow,
                                null,
                                companyId,
                                queueIntegrations,
                                ticket,
                                contactForCampaign,
                                null,
                                null
                            );

                            if (campaignExecuted) {
                                logger.info(`[WHATSAPP OFICIAL - FLOW] ✅ Campanha executada com sucesso para ticket ${ticket.id}, parando outros fluxos`);
                                return;
                            } else {
                                logger.info(`[WHATSAPP OFICIAL - FLOW] ℹ️ Nenhuma campanha executada para ticket ${ticket.id} (mensagem: "${message.text || 'vazia'}")`);
                            }
                        } catch (flowError) {
                            logger.error("[WHATSAPP OFICIAL - FLOW] ❌ Erro ao executar flowbuilderIntegration:", flowError);
                            
                            // ✅ LIMPAR ESTADO EM CASO DE ERRO (igual ao Baileys)
                            try {
                                await ticket.update({
                                    flowWebhook: false,
                                    isBot: false,
                                    lastFlowId: null,
                                    hashFlowId: null,
                                    flowStopped: null
                                });
                                logger.info(`[WHATSAPP OFICIAL - FLOW] 🧹 Estado do ticket ${ticket.id} limpo após erro`);
                            } catch (cleanupError) {
                                logger.error(`[WHATSAPP OFICIAL - FLOW] ❌ Erro ao limpar estado do ticket:`, cleanupError);
                            }
                        }
                    } catch (error) {
                        logger.error("[WHATSAPP OFICIAL] ❌ Erro ao verificar campanhas:", error);
                        
                        // ✅ LIMPAR ESTADO EM CASO DE ERRO GERAL
                        try {
                            await ticket.update({
                                flowWebhook: false,
                                isBot: false,
                                lastFlowId: null,
                                hashFlowId: null,
                                flowStopped: null
                            });
                        } catch (cleanupError) {
                            logger.error("[WHATSAPP OFICIAL] ❌ Erro ao limpar estado do ticket:", cleanupError);
                        }
                    }
                }
            }

            // ✅ VERIFICAÇÃO DE INTEGRAÇÕES EXISTENTES
            // ✅ CONTINUAÇÃO DE FLUXO WEBHOOK EXISTENTE (sem campanha)
            if (ticket.flowWebhook && ticket.hashFlowId) {
                // ✅ CORREÇÃO: Ignorar hashFlowId de recovery (artificial)
                const isRecoveryHash = ticket.hashFlowId.startsWith('recovery-');
                
                if (!isRecoveryHash) {
                    console.log(
                        `[FLOW WEBHOOK - OFICIAL] Processando fluxo webhook existente para ticket ${ticket.id}`
                    );

                    try {
                        const webhook = await WebhookModel.findOne({
                            where: {
                                company_id: ticket.companyId,
                                hash_id: ticket.hashFlowId
                            }
                        });

                        if (webhook && webhook.config["details"]) {
                            const flow = await FlowBuilderModel.findOne({
                                where: {
                                    id: webhook.config["details"].idFlow,
                                    company_id: companyId
                                }
                            });

                            if (flow) {
                                const nodes: any[] = flow.flow["nodes"];
                                const connections: any[] = flow.flow["connections"];
                                const numberPhrase = { number: contact.number, name: contact.name, email: contact.email || "" };

                                await ActionsWebhookService(
                                    whatsapp.id,
                                    webhook.config["details"].idFlow,
                                    ticket.companyId,
                                    nodes,
                                    connections,
                                    ticket.lastFlowId,
                                    ticket.dataWebhook,
                                    webhook.config["details"],
                                    ticket.hashFlowId,
                                    message.text || "",
                                    ticket.id,
                                    numberPhrase
                                );

                                console.log("[FLOW WEBHOOK - OFICIAL] ✅ Fluxo webhook executado!");
                                return; // Após processar o fluxo, sair para evitar cair em outras verificações
                            } else {
                                console.error(
                                    `[FLOW WEBHOOK - OFICIAL] ❌ Fluxo ${webhook.config["details"].idFlow} não encontrado`
                                );
                            }
                        }
                    } catch (error) {
                        console.error("[FLOW WEBHOOK - OFICIAL] ❌ Erro ao processar fluxo webhook:", error);
                    }
                }
            }
            
            // ✅ RECOVERY: Apenas quando NÃO tem hashFlowId válido
            if (ticket.flowWebhook && !ticket.hashFlowId && ticket.flowStopped) {
                // Fallback: continuar fluxo usando flowStopped quando hashFlowId estiver ausente
                try {
                    const recoveredFlowId = parseInt(String(ticket.flowStopped));
                    if (!isNaN(recoveredFlowId)) {
                        const flow = await FlowBuilderModel.findOne({
                            where: { id: recoveredFlowId, company_id: companyId }
                        });

                        if (flow) {
                            console.warn(`[FLOW WEBHOOK - OFICIAL][RECOVERY] Continuando fluxo via flowStopped=${recoveredFlowId} para ticket ${ticket.id}`);

                            const nodes: any[] = flow.flow["nodes"];
                            const connections: any[] = flow.flow["connections"];
                            const recoveryHash = `recovery-${ticket.id}`;
                            const minimalDetails = { idFlow: recoveredFlowId, inputs: [], keysFull: [] } as any;
                            const numberPhrase = { number: contact.number, name: contact.name, email: contact.email || "" };

                            await ActionsWebhookService(
                                whatsapp.id,
                                recoveredFlowId,
                                ticket.companyId,
                                nodes,
                                connections,
                                ticket.lastFlowId,
                                ticket.dataWebhook,
                                minimalDetails,
                                recoveryHash,
                                message.text || "",
                                ticket.id,
                                numberPhrase
                            );

                            console.log("[FLOW WEBHOOK - OFICIAL][RECOVERY] ✅ Fluxo executado via flowStopped");
                            return;
                        }
                    }
                } catch (error) {
                    console.error("[FLOW WEBHOOK - OFICIAL][RECOVERY] ❌ Erro no fallback de fluxo:", error);
                }
            }

            if (
                !ticket.imported &&
                !ticket.queue &&
                !ticket.isGroup &&
                !ticket.user &&
                !isNil(whatsapp.integrationId)
            ) {
                const integrations = await ShowQueueIntegrationService(
                    whatsapp.integrationId,
                    companyId
                );

                // Criar um objeto msg simulado para compatibilidade
                const simulatedMsg = {
                    key: {
                        fromMe: false,
                        remoteJid: `${fromNumber}@s.whatsapp.net`,
                        id: message.idMessage
                    },
                    message: {
                        conversation: message.text || "",
                        timestamp: message.timestamp
                    }
                };

                await handleMessageIntegration(
                    simulatedMsg as any,
                    null, // wbot é null
                    companyId,
                    integrations,
                    ticket
                );

                await ticket.update({
                    useIntegration: true,
                    integrationId: integrations.id
                });

                return;
            }

            // ✅ VERIFICAÇÃO DE INTEGRAÇÕES NO TICKET
            if (
                !ticket.imported &&
                !ticket.isGroup &&
                !ticket.userId &&
                ticket.integrationId &&
                ticket.useIntegration
            ) {
                const integrations = await ShowQueueIntegrationService(
                    ticket.integrationId,
                    companyId
                );

                // Criar um objeto msg simulado para compatibilidade
                const simulatedMsg = {
                    key: {
                        fromMe: false,
                        remoteJid: `${fromNumber}@s.whatsapp.net`,
                        id: message.idMessage
                    },
                    message: {
                        conversation: message.text || "",
                        timestamp: message.timestamp
                    }
                };

                await handleMessageIntegration(
                    simulatedMsg as any,
                    null, // wbot é null
                    companyId,
                    integrations,
                    ticket
                );
            }

            // ✅ VERIFICAÇÃO FINAL DE CAMPANHAS (após outros processamentos)
            if (
                !campaignExecuted && // ✅ Só verificar se campanha NÃO foi executada antes
                !ticket.imported &&
                !ticket.isGroup &&
                ticket.status === "pending"
            ) {
                logger.info(`[WHATSAPP OFICIAL - FLOW] ⏱️ Agendando verificação final de campanhas para ticket ${ticket.id} (setTimeout 1s)`);
                
                // Aguardar um pouco para garantir que outros processamentos terminaram
                setTimeout(async () => {
                    try {
                        await ticket.reload({
                            include: [{ model: Contact, as: "contact" }]
                        });

                        // Só verificar se não entrou em fluxo
                        if (!ticket.flowWebhook || !ticket.lastFlowId) {
                            logger.info(`[WHATSAPP OFICIAL - FLOW] 🔄 Verificação final: ticket ${ticket.id} não está em fluxo, tentando iniciar`);
                            
                            const contactForCampaign = await ShowContactService(
                                ticket.contactId,
                                ticket.companyId
                            );

                            // Verificar se existe integrationId antes de prosseguir
                            try {
                                if (!whatsapp.integrationId) {
                                    logger.info(`[WHATSAPP OFICIAL - FLOW] ⚠️ whatsapp.integrationId não definido para conexão ${whatsapp.id}, encerrando verificação final`);
                                    return; // Encerrar execução se não houver integrationId
                                }
                                
                                logger.info(`[WHATSAPP OFICIAL - FLOW] 🔎 Conexão ${whatsapp.id} possui integrationId, buscando integrações...`);

                                const queueIntegrations = await ShowQueueIntegrationService(
                                    whatsapp.integrationId,
                                    companyId
                                );

                                logger.info(`[WHATSAPP OFICIAL - FLOW] 🚀 Chamando flowbuilderIntegration (verificação final) para ticket ${ticket.id}, integração tipo: ${queueIntegrations?.type || 'indefinido'}`);

                                // ✅ VERIFICAÇÃO FINAL APENAS SE NECESSÁRIO
                                const simulatedMsgForFlow2 = {
                                    key: {
                                        fromMe: false,
                                        remoteJid: `${fromNumber}@s.whatsapp.net`,
                                        id: message.idMessage || `ofc-${Date.now()}`
                                    },
                                    message: {
                                        conversation: message.text || ticket.lastMessage || "",
                                        timestamp: message.timestamp || Math.floor(Date.now() / 1000)
                                    }
                                } as any;

                                const finalCampaignExecuted = await flowbuilderIntegration(
                                    simulatedMsgForFlow2, // usar mensagem simulada
                                    null, // wbot é null
                                    companyId,
                                    queueIntegrations,
                                    ticket,
                                    contact,
                                    null,
                                    null
                                );

                                if (finalCampaignExecuted) {
                                    logger.info(`[WHATSAPP OFICIAL - FLOW] ✅ Campanha executada na verificação final para ticket ${ticket.id}`);
                                } else {
                                    logger.info(`[WHATSAPP OFICIAL - FLOW] ℹ️ Nenhuma campanha executada na verificação final para ticket ${ticket.id}`);
                                }
                            } catch (error) {
                                logger.error(`[WHATSAPP OFICIAL - FLOW] ❌ Erro ao verificar campanhas (verificação final) para ticket ${ticket.id}:`, error);
                            }
                        } else {
                            logger.info(`[WHATSAPP OFICIAL - FLOW] ⏭️ Ticket ${ticket.id} já está em fluxo (flowWebhook=${ticket.flowWebhook}, lastFlowId=${ticket.lastFlowId}), pulando verificação final`);
                        }
                    } catch (error) {
                        logger.error(`[WHATSAPP OFICIAL - FLOW] ❌ Erro geral na verificação final para ticket ${ticket.id}:`, error);
                    }
                }, 1000); // Aguardar 1 segundo para garantir que outros processamentos terminaram
            } else {
                logger.info(`[WHATSAPP OFICIAL - FLOW] ⏭️ Pulando verificação final para ticket ${ticket.id} - Razão: ${campaignExecuted ? 'campanha já executada' : ticket.imported ? 'ticket importado' : ticket.isGroup ? 'é grupo' : ticket.status !== 'pending' ? `status=${ticket.status}` : 'desconhecida'}`);
            }

        } catch (error) {
            console.error("[WHATSAPP OFICIAL] Erro em getMessage:", error);
            logger.error(`[WHATSAPP OFICIAL] Erro getMessage: ${error}`);
        }
    }

    async readMessage(data: IReceivedReadWhatsppOficialRead) {
        const { messageId, token, companyId } = data;

        try {
            console.log("data READ", data);
            const conexao = await Whatsapp.findOne({ where: { token, companyId } });

            if (!conexao) {
                logger.error('readMessage - Nenhum whatsApp encontrado');
                return;
            }

            const message = await Message.findOne({ where: { wid: messageId, companyId } });

            if (!message) {
                logger.error(`readMessage - Mensagem não encontrada - ${messageId}`);
                return;
            }
            message.update({ read: true, ack: 2 });
        } catch (error) {
            logger.error(`Erro ao atualizar ack da mensagem ${messageId} - ${error}`);
        }
    }
}