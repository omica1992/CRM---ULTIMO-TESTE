import { WASocket, proto } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowDialogChatBotsServices from "../DialogChatBotsServices/ShowDialogChatBotsServices";
import ShowQueueService from "../QueueService/ShowQueueService";
import ShowChatBotServices from "../ChatBotServices/ShowChatBotServices";
import DeleteDialogChatBotsServices from "../DialogChatBotsServices/DeleteDialogChatBotsServices";
import ShowChatBotByChatbotIdServices from "../ChatBotServices/ShowChatBotByChatbotIdServices";
import CreateDialogChatBotsServices from "../DialogChatBotsServices/CreateDialogChatBotsServices";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import formatBody from "../../helpers/Mustache";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Chatbot from "../../models/Chatbot";
import User from "../../models/User";
import { sendText } from "../FacebookServices/graphAPI";
import { Session } from "../../libs/wbot";
import logger from "../../utils/logger";
import {
  classifyMenuInput,
  clearMenuMediaWarning,
  getMenuStageKey,
  MENU_MEDIA_WARNING_TEXT,
  shouldSendMenuMediaWarning
} from "./MenuBotUtils";


const isNumeric = (value: string) => /^-?\d+$/.test(value);

const buildMenuOptionsText = (
  options: Pick<Chatbot, "name">[] = [],
  includeBackToMainMenu = true
) => {
  let menuOptions = "";

  options.forEach((option, index) => {
    menuOptions += `*[ ${index + 1} ]* - ${option.name}\n`;
  });

  if (includeBackToMainMenu) {
    menuOptions += `*[ # ]* Voltar para o menu principal\n`;
  }

  menuOptions += `*[ Sair ]* Encerrar atendimento`;

  return menuOptions.trim();
};

export const deleteAndCreateDialogStage = async (
  contact: Contact,
  chatbotId: number,
  ticket: Ticket
) => {
  try {
    await DeleteDialogChatBotsServices(contact.id);
    const bots = await ShowChatBotByChatbotIdServices(chatbotId);
    if (!bots) {
      await ticket.update({ isBot: false });
    }
    return await CreateDialogChatBotsServices({
      awaiting: 1,
      contactId: contact.id,
      chatbotId,
      queueId: bots.queueId
    });
  } catch (error) {
    await ticket.update({ isBot: false });
  }
};

const sendMessage = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket,
  body: string
) => {
  const sentMessage = await sendText(
    contact.number,
    formatBody(body, ticket),
    ticket.whatsapp.facebookUserToken
  );
};

const sendDialog = async (
  choosenQueue: Chatbot,
  contact: Contact,
  ticket: Ticket
) => {
  const showChatBots = await ShowChatBotServices(choosenQueue.id);
  if (showChatBots.options) {
    let options = "";

    showChatBots.options.forEach((option, index) => {
      options += `*${index + 1}* - ${option.name}\n`;
    });

    const optionsBack =
      options.length > 0
        ? `${options}\n*#* Voltar para o menu principal`
        : options;

    if (options.length > 0) {
      const body = `\u200e${choosenQueue.greetingMessage}\n\n${optionsBack}`;
      // const sendOption = await sendMessage(wbot, contact, ticket, body);

      const sendOption = await sendText(
        contact.number,
        formatBody(body, ticket),
        ticket.whatsapp.facebookUserToken
      );

      return sendOption;
    }

    const body = `\u200e${choosenQueue.greetingMessage}`;
    const send = await sendText(
      contact.number,
      formatBody(body, ticket),
      ticket.whatsapp.facebookUserToken
    );
    return send;
  }

  let options = "";

  showChatBots.options.forEach((option, index) => {
    options += `*${index + 1}* - ${option.name}\n`;
  });

  const optionsBack =
    options.length > 0
      ? `${options}\n*#* Voltar para o menu principal`
      : options;

  if (options.length > 0) {
    const body = `\u200e${choosenQueue.greetingMessage}\n\n${optionsBack}`;
    const sendOption = await sendText(
      contact.number,
      formatBody(body, ticket),
      ticket.whatsapp.facebookUserToken
    );
    return sendOption;
  }

  const body = `\u200e${choosenQueue.greetingMessage}`;
  const send = await sendText(
    contact.number,
    formatBody(body, ticket),
    ticket.whatsapp.facebookUserToken
  );
  return send;
};

const backToMainMenu = async (
  wbot: Session,
  contact: Contact,
  ticket: Ticket
) => {
  await UpdateTicketService({
    ticketData: { queueId: null },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
  // console.log("GETTING WHATSAPP BACK TO MAIN MENU", ticket.whatsappId, wbot.id)
  const { queues, greetingMessage } = await ShowWhatsAppService(wbot.id!, ticket.companyId);


  let options = "";

    queues.forEach((option, index) => {
      options += `*${index + 1}* - ${option.name}\n`;
    });

    const body = formatBody(`\u200e${greetingMessage}\n\n${options}`, ticket);
    await sendMessage(wbot, contact, ticket, body);

    const deleteDialog = await DeleteDialogChatBotsServices(contact.id);
    return deleteDialog;
};

export const sayChatbot = async (
  queueId: number,
  wbot: any,
  ticket: Ticket,
  contact: Contact,
  msg: any
): Promise<any> => {
  const selectedOption =
    typeof msg?.text === "string" ? msg.text.trim() : "";
  const hasMediaWithoutText =
    !selectedOption &&
    Array.isArray(msg?.attachments) &&
    msg.attachments.length > 0;
  const menuInputType = classifyMenuInput({
    text: selectedOption,
    isMediaWithoutText: hasMediaWithoutText
  });

  if (!queueId && selectedOption && msg.is_echo) return;

  if (ticket.userId) {
    clearMenuMediaWarning(ticket.id);
    return;
  }

  const getStageBot = await ShowDialogChatBotsServices(contact.id);
  const queueStageKey = getMenuStageKey({
    channel: "facebook",
    queueId,
    stageChatbotId: (getStageBot as any)?.chatbotId || null
  });

  if (selectedOption.toLowerCase() === "sair") {
    clearMenuMediaWarning(ticket.id);
    logger.info(
      `[MENU BOT] event=valid_option_processed channel=facebook ticketId=${ticket.id} option=sair`
    );
    await UpdateTicketService({
      ticketData: {
        isBot: false,
        status: "closed",
        sendFarewellMessage: true,
        amountUsedBotQueues: 0
      },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });
    return;
  }

  if (selectedOption === "#") {
    clearMenuMediaWarning(ticket.id);
    logger.info(
      `[MENU BOT] event=valid_option_processed channel=facebook ticketId=${ticket.id} option=#`
    );
    const backTo = await backToMainMenu(wbot, contact, ticket);
    return backTo;
  }

  if (!getStageBot) {
    const queue = await ShowQueueService(queueId, ticket.companyId);
    const hasQueueOptions = (queue.chatbots?.length || 0) > 0;

    if (!hasQueueOptions) {
      clearMenuMediaWarning(ticket.id);
      logger.info(
        `[MENU BOT] event=ignored_no_menu channel=facebook ticketId=${ticket.id} queueId=${queueId} reason=no_queue_options`
      );
      return;
    }

    if (menuInputType === "media_no_text") {
      const shouldWarn = shouldSendMenuMediaWarning(ticket.id, queueStageKey);
      if (shouldWarn) {
        const body = `${MENU_MEDIA_WARNING_TEXT}\n\n${formatBody(
          queue.greetingMessage || "Digite uma das opções abaixo:",
          ticket
        )}\n\n${buildMenuOptionsText(queue.chatbots || [], true)}`;
        await sendMessage(wbot, contact, ticket, body);
        logger.info(
          `[MENU BOT] event=warned_media_once channel=facebook ticketId=${ticket.id} queueId=${queueId} stageKey=${queueStageKey}`
        );
      }
      return;
    }

    const choosenQueue = queue.chatbots[+selectedOption - 1];
    if (!choosenQueue) {
      const body =
        `\u200eOpção inválida! Digite um número válido para continuar!\n\n` +
        `${formatBody(
          queue.greetingMessage || "Digite uma das opções abaixo:",
          ticket
        )}\n\n${buildMenuOptionsText(queue.chatbots || [], true)}`;
      await sendMessage(wbot, contact, ticket, body);
      logger.info(
        `[MENU BOT] event=invalid_option_sent channel=facebook ticketId=${ticket.id} queueId=${queueId} inputType=${menuInputType}`
      );
      return;
    }

    clearMenuMediaWarning(ticket.id);
    logger.info(
      `[MENU BOT] event=valid_option_processed channel=facebook ticketId=${ticket.id} queueId=${queueId} option=${selectedOption}`
    );

    if (!choosenQueue?.greetingMessage) {
      await DeleteDialogChatBotsServices(contact.id);
      clearMenuMediaWarning(ticket.id);
      return;
    } // nao tem mensagem de boas vindas

    if (choosenQueue) {
      if (choosenQueue.isAgent) {
        const getUserByName = await User.findOne({
          where: {
            name: choosenQueue.name
          }
        });
        const ticketUpdateAgent = {
          ticketData: {
            userId: getUserByName.id,
            status: "open",
          },
          ticketId: ticket.id,
          companyId: ticket.companyId
        };
        await UpdateTicketService(ticketUpdateAgent);
      }
      await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
      const send = await sendDialog(choosenQueue, contact, ticket);
      return send;
    }
  }

  if (getStageBot) {
    const selected = isNumeric(selectedOption) ? selectedOption : 0;
    const bots = await ShowChatBotServices(getStageBot.chatbotId);
    const hasStageOptions = (bots.options?.length || 0) > 0;

    if (!hasStageOptions) {
      await DeleteDialogChatBotsServices(contact.id);
      clearMenuMediaWarning(ticket.id);
      logger.info(
        `[MENU BOT] event=ignored_no_menu channel=facebook ticketId=${ticket.id} queueId=${queueId} reason=empty_stage_options`
      );
      return;
    }

    if (menuInputType === "media_no_text") {
      const shouldWarn = shouldSendMenuMediaWarning(ticket.id, queueStageKey);
      if (shouldWarn) {
        const body = `${MENU_MEDIA_WARNING_TEXT}\n\n${formatBody(
          bots.greetingMessage || "Digite uma das opções abaixo:",
          ticket
        )}\n\n${buildMenuOptionsText(bots.options || [], true)}`;
        await sendMessage(wbot, ticket.contact, ticket, body);
        logger.info(
          `[MENU BOT] event=warned_media_once channel=facebook ticketId=${ticket.id} queueId=${queueId} stageKey=${queueStageKey}`
        );
      }
      return;
    }

    if (selected === 0 || +selected > bots.options.length) {
      const body =
        `\u200eOpção inválida! Digite um número válido para continuar!\n\n` +
        `${formatBody(
          bots.greetingMessage || "Digite uma das opções abaixo:",
          ticket
        )}\n\n${buildMenuOptionsText(bots.options || [], true)}`;
      await sendMessage(wbot, ticket.contact, ticket, body);
      logger.info(
        `[MENU BOT] event=invalid_option_sent channel=facebook ticketId=${ticket.id} queueId=${queueId} stageKey=${queueStageKey} inputType=${menuInputType}`
      );
      return;
    }

    clearMenuMediaWarning(ticket.id);
    logger.info(
      `[MENU BOT] event=valid_option_processed channel=facebook ticketId=${ticket.id} queueId=${queueId} stageKey=${queueStageKey} option=${selectedOption}`
    );

    const choosenQueue = bots.options[+selected - 1]
      ? bots.options[+selected - 1]
      : bots.options[0];
    if (!choosenQueue.greetingMessage) {
      await DeleteDialogChatBotsServices(contact.id);
      return;
    } // nao tem mensagem de boas vindas
    if (choosenQueue) {
      if (choosenQueue.isAgent) {
        const getUserByName = await User.findOne({
          where: {
            name: choosenQueue.name
          }
        });
        const ticketUpdateAgent = {
          ticketData: {
            userId: getUserByName.id,
            status: "open"
          },
          ticketId: ticket.id,
          companyId: ticket.companyId
        };
        await UpdateTicketService(ticketUpdateAgent);
      }
      await deleteAndCreateDialogStage(contact, choosenQueue.id, ticket);
      const send = await sendDialog(choosenQueue,  contact, ticket);
      return send;
    }
  }
};
