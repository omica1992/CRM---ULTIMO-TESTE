import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { Op } from "sequelize";
import puppeteer from "puppeteer-core";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import isQueueIdHistoryBlocked from "../UserServices/isQueueIdHistoryBlocked";
import ShowTicketService from "./ShowTicketService";

interface Request {
  ticketId: string | number;
  companyId: number;
  userId: number;
}

interface Response {
  buffer: Buffer;
  filename: string;
}

const resolveBrowserExecutablePath = (): string => {
  const envPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_BIN ||
    process.env.CHROMIUM_PATH;

  const candidates = [
    envPath,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium"
  ].filter(Boolean) as string[];

  const executablePath = candidates.find(candidate => fs.existsSync(candidate));

  if (!executablePath) {
    throw new AppError(
      "Chrome/Chromium não encontrado para gerar o PDF. Configure PUPPETEER_EXECUTABLE_PATH no backend.",
      500
    );
  }

  return executablePath;
};

const escapeHtml = (value?: string | null): string => {
  if (!value) return "";

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const nl2br = (value?: string | null): string =>
  escapeHtml(value).replace(/\r?\n/g, "<br />");

const formatMessageTimestamp = (value: Date | string): string => {
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "";
  }
};

const getMediaMarkup = (message: Message): string => {
  const mediaUrl = message.mediaUrl;
  if (!mediaUrl) return "";

  const mediaType = (message.mediaType || "").toLowerCase();
  const fileName = mediaUrl.split("/").pop() || "arquivo";
  const safeFileName = escapeHtml(fileName);
  const safeMediaUrl = escapeHtml(mediaUrl);

  if (["image", "image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
    return `
      <div class="message-media">
        <img src="${safeMediaUrl}" alt="${safeFileName}" />
      </div>
    `;
  }

  return `
    <div class="message-attachment">
      <span>Anexo:</span>
      <a href="${safeMediaUrl}" target="_blank" rel="noreferrer">${safeFileName}</a>
    </div>
  `;
};

const buildMessageHtml = (message: Message, contactName: string): string => {
  const isOutgoing = Boolean(message.fromMe);
  const senderName = isOutgoing ? "Atendimento" : contactName;
  const body = message.isDeleted ? "<em>Mensagem removida</em>" : nl2br(message.body);
  const quotedBody = message.quotedMsg?.body ? nl2br(message.quotedMsg.body) : "";
  const quotedName = message.quotedMsg?.fromMe ? "Atendimento" : (message.quotedMsg?.contact?.name || contactName);
  const privateBadge = message.isPrivate ? `<div class="message-badge">Nota interna</div>` : "";

  return `
    <div class="message-row ${isOutgoing ? "outgoing" : "incoming"}">
      <div class="message-bubble">
        ${privateBadge}
        <div class="message-meta">
          <span class="sender">${escapeHtml(senderName)}</span>
          <span class="timestamp">${escapeHtml(formatMessageTimestamp(message.createdAt))}</span>
        </div>
        ${quotedBody ? `
          <div class="quoted-message">
            <div class="quoted-name">${escapeHtml(quotedName)}</div>
            <div class="quoted-body">${quotedBody}</div>
          </div>
        ` : ""}
        ${body ? `<div class="message-body">${body}</div>` : ""}
        ${getMediaMarkup(message)}
      </div>
    </div>
  `;
};

const buildHtml = ({
  ticket,
  messages
}: {
  ticket: Ticket;
  messages: Message[];
}): string => {
  const contactName = ticket.contact?.name || "Contato";
  const queueName = ticket.queue?.name || "Sem fila";
  const companyName = ticket.company?.name || "Empresa";
  const channelName = ticket.channel || "whatsapp";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatorio de atendimento ${ticket.id}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #243447;
            font-size: 12px;
          }

          .page {
            width: 100%;
          }

          .header {
            border-bottom: 1px solid #d8dee9;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }

          .header h1 {
            margin: 0 0 10px;
            font-size: 20px;
            color: #1f3fb7;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 16px;
          }

          .meta-item {
            display: flex;
            gap: 8px;
          }

          .meta-label {
            color: #6b7a90;
            min-width: 76px;
            font-weight: bold;
          }

          .conversation {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .message-row {
            display: flex;
            width: 100%;
          }

          .message-row.incoming {
            justify-content: flex-start;
          }

          .message-row.outgoing {
            justify-content: flex-end;
          }

          .message-bubble {
            width: 78%;
            border: 1px solid #d8dee9;
            border-radius: 8px;
            padding: 10px 12px;
            background: #f8fafc;
            page-break-inside: avoid;
            white-space: normal;
          }

          .message-row.outgoing .message-bubble {
            background: #e9f5ea;
          }

          .message-meta {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
            color: #6b7a90;
            font-size: 11px;
          }

          .sender {
            font-weight: bold;
            color: #243447;
          }

          .message-badge {
            display: inline-block;
            margin-bottom: 8px;
            padding: 2px 6px;
            border-radius: 999px;
            background: #fff4ce;
            color: #8a5a00;
            font-size: 10px;
            font-weight: bold;
          }

          .quoted-message {
            border-left: 3px solid #1f3fb7;
            background: rgba(31, 63, 183, 0.06);
            padding: 8px 10px;
            margin-bottom: 8px;
          }

          .quoted-name {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 4px;
          }

          .message-body {
            line-height: 1.5;
            word-break: break-word;
          }

          .message-media {
            margin-top: 10px;
          }

          .message-media img {
            max-width: 100%;
            max-height: 320px;
            border-radius: 6px;
            border: 1px solid #d8dee9;
          }

          .message-attachment {
            margin-top: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .message-attachment a {
            color: #1f3fb7;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1>Relatorio de Atendimento</h1>
            <div class="meta-grid">
              <div class="meta-item"><span class="meta-label">Ticket</span><span>#${ticket.id}</span></div>
              <div class="meta-item"><span class="meta-label">Empresa</span><span>${escapeHtml(companyName)}</span></div>
              <div class="meta-item"><span class="meta-label">Contato</span><span>${escapeHtml(contactName)}</span></div>
              <div class="meta-item"><span class="meta-label">Numero</span><span>${escapeHtml(ticket.contact?.number || "-")}</span></div>
              <div class="meta-item"><span class="meta-label">Fila</span><span>${escapeHtml(queueName)}</span></div>
              <div class="meta-item"><span class="meta-label">Canal</span><span>${escapeHtml(channelName)}</span></div>
              <div class="meta-item"><span class="meta-label">Status</span><span>${escapeHtml(ticket.status || "-")}</span></div>
              <div class="meta-item"><span class="meta-label">Gerado em</span><span>${escapeHtml(formatMessageTimestamp(new Date()))}</span></div>
            </div>
          </div>

          <div class="conversation">
            ${messages.map(message => buildMessageHtml(message, contactName)).join("")}
          </div>
        </div>
      </body>
    </html>
  `;
};

const GenerateTicketConversationPdfService = async ({
  ticketId,
  companyId,
  userId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId, companyId);

  const user = await User.findByPk(userId, {
    include: [{ model: Queue, as: "queues" }]
  });

  if (!user) {
    throw new AppError("Usuário não encontrado", 404);
  }

  const isAllHistoricEnabled = await isQueueIdHistoryBlocked({ userRequest: user.id });

  const queueFilter =
    !isAllHistoricEnabled &&
    user.profile !== "admin" &&
    user.allTicket !== "enable" &&
    !(ticket.isGroup && user.allowGroup)
      ? { [Op.in]: user.queues.map(queue => queue.id) }
      : undefined;

  const ticketIds = await Ticket.findAll({
    where: {
      id: { [Op.lte]: ticket.id },
      companyId: ticket.companyId,
      contactId: ticket.contactId,
      whatsappId: ticket.whatsappId,
      isGroup: ticket.isGroup,
      ...(queueFilter ? { queueId: queueFilter } : {})
    },
    attributes: ["id"]
  });

  const visibleTicketIds = ticketIds.map(item => item.id);

  if (!visibleTicketIds.length) {
    throw new AppError("Nenhuma mensagem encontrada para exportar", 404);
  }

  const messages = await Message.findAll({
    where: {
      ticketId: visibleTicketIds,
      companyId
    },
    attributes: [
      "id",
      "wid",
      "fromMe",
      "mediaUrl",
      "body",
      "mediaType",
      "ack",
      "createdAt",
      "ticketId",
      "isDeleted",
      "queueId",
      "isForwarded",
      "isEdited",
      "isPrivate",
      "companyId"
    ],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name"]
      },
      {
        model: Message,
        as: "quotedMsg",
        attributes: ["id", "wid", "fromMe", "mediaUrl", "body", "mediaType", "companyId"],
        required: false,
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name"]
          }
        ]
      }
    ],
    order: [["createdAt", "ASC"]]
  });

  const executablePath = resolveBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml({ ticket, messages }), {
      waitUntil: "networkidle0"
    });

    const buffer = Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "12mm",
          right: "12mm",
          bottom: "12mm",
          left: "12mm"
        }
      })
    );

    const filename = `relatorio_atendimento_${ticket.id}.pdf`;

    return { buffer, filename };
  } finally {
    await browser.close();
  }
};

export default GenerateTicketConversationPdfService;
