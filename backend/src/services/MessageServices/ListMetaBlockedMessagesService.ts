import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { getMetaResendEligibility } from "./MetaResendEligibility";

interface Request {
  companyId: number;
  searchParam?: string;
  contactId?: string;
  whatsappIds?: number[];
  queueIds?: number[];
  tagIds?: number[];
  userIds?: number[];
  statusIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  pageNumber?: number;
  pageSize?: number;
  empresa?: string;
  cpf?: string;
}

interface MetaBlockedRow {
  id: number;
  ticketId: number;
  ticketUuid: string;
  ticketStatus: string;
  whatsappId: number;
  whatsappName: string;
  contactId: number;
  contactName: string;
  contactNumber: string;
  userId: number;
  userName: string;
  queueId: number;
  queueName: string;
  body: string;
  mediaType: string;
  deliveryError: string;
  deliveryErrorCode: string;
  createdAt: Date;
  deliveryErrorAt: Date;
}

interface MetaBlockedItem extends MetaBlockedRow {
  resendEligible: boolean;
  resendBlockedReason: string | null;
}

interface Response {
  messages: MetaBlockedItem[];
  totalMessages: number;
  hasMore: boolean;
}

const ListMetaBlockedMessagesService = async ({
  companyId,
  searchParam = "",
  contactId,
  whatsappIds = [],
  queueIds = [],
  tagIds = [],
  userIds = [],
  statusIds = [],
  dateFrom,
  dateTo,
  pageNumber = 1,
  pageSize = 20,
  empresa,
  cpf
}: Request): Promise<Response> => {
  const safePageNumber = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;
  const offset = (safePageNumber - 1) * safePageSize;

  const whereClauses: string[] = [
    `m."companyId" = :companyId`,
    `m."fromMe" = true`,
    `m."ack" = -1`,
    `m."deliveryError" IS NOT NULL`,
    `(w."provider" = 'oficial' OR w."channel" IN ('whatsapp_oficial', 'whatsapp-oficial') OR t."channel" IN ('whatsapp_oficial', 'whatsapp-oficial'))`
  ];

  const replacements: Record<string, any> = {
    companyId,
    limit: safePageSize,
    offset
  };

  if (dateFrom) {
    whereClauses.push(
      `COALESCE(m."deliveryErrorAt", m."createdAt") >= :dateFrom`
    );
    replacements.dateFrom = `${dateFrom} 00:00:00`;
  }

  if (dateTo) {
    whereClauses.push(
      `COALESCE(m."deliveryErrorAt", m."createdAt") <= :dateTo`
    );
    replacements.dateTo = `${dateTo} 23:59:59`;
  }

  if (searchParam?.trim()) {
    whereClauses.push(
      `(LOWER(COALESCE(c."name", '')) LIKE :searchParam OR LOWER(COALESCE(m."body", '')) LIKE :searchParam OR LOWER(COALESCE(m."deliveryError", '')) LIKE :searchParam OR CAST(m."ticketId" AS TEXT) LIKE :searchParamText)`
    );
    replacements.searchParam = `%${searchParam.trim().toLowerCase()}%`;
    replacements.searchParamText = `%${searchParam.trim()}%`;
  }

  if (contactId) {
    whereClauses.push(`t."contactId" = :contactId`);
    replacements.contactId = Number(contactId);
  }

  if (whatsappIds.length > 0) {
    whereClauses.push(`t."whatsappId" IN (:whatsappIds)`);
    replacements.whatsappIds = whatsappIds;
  }

  if (queueIds.length > 0) {
    whereClauses.push(`COALESCE(t."queueId", 0) IN (:queueIds)`);
    replacements.queueIds = queueIds;
  }

  if (userIds.length > 0) {
    whereClauses.push(`t."userId" IN (:userIds)`);
    replacements.userIds = userIds;
  }

  if (statusIds.length > 0) {
    whereClauses.push(`t."status" IN (:statusIds)`);
    replacements.statusIds = statusIds;
  }

  if (tagIds.length > 0) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM "ContactTags" ct WHERE ct."contactId" = t."contactId" AND ct."tagId" IN (:tagIds))`
    );
    replacements.tagIds = tagIds;
  }

  if (empresa?.trim()) {
    whereClauses.push(`LOWER(COALESCE(c."empresa", '')) LIKE :empresa`);
    replacements.empresa = `%${empresa.trim().toLowerCase()}%`;
  }

  if (cpf?.trim()) {
    whereClauses.push(`COALESCE(c."cpf", '') LIKE :cpf`);
    replacements.cpf = `%${cpf.trim()}%`;
  }

  const baseFromAndWhere = `
    FROM "Messages" m
    INNER JOIN "Tickets" t ON t.id = m."ticketId"
    LEFT JOIN "Contacts" c ON c.id = t."contactId"
    LEFT JOIN "Users" u ON u.id = t."userId"
    LEFT JOIN "Queues" q ON q.id = t."queueId"
    LEFT JOIN "Whatsapps" w ON w.id = t."whatsappId"
    WHERE ${whereClauses.join(" AND ")}
  `;

  const countQuery = `
    SELECT COUNT(*)::INTEGER AS total
    ${baseFromAndWhere}
  `;

  const countResult = await sequelize.query<{ total: number }>(countQuery, {
    type: QueryTypes.SELECT,
    replacements
  });

  const totalMessages = countResult?.[0]?.total || 0;

  const dataQuery = `
    SELECT
      m.id,
      m."ticketId",
      t.uuid AS "ticketUuid",
      t.status AS "ticketStatus",
      t."whatsappId",
      w."name" AS "whatsappName",
      t."contactId",
      c."name" AS "contactName",
      c."number" AS "contactNumber",
      t."userId",
      u."name" AS "userName",
      t."queueId",
      q."name" AS "queueName",
      m."body",
      m."mediaType",
      m."deliveryError",
      m."deliveryErrorCode",
      m."createdAt",
      m."deliveryErrorAt"
    ${baseFromAndWhere}
    ORDER BY COALESCE(m."deliveryErrorAt", m."createdAt") DESC, m.id DESC
    LIMIT :limit OFFSET :offset
  `;

  const rows = await sequelize.query<MetaBlockedRow>(dataQuery, {
    type: QueryTypes.SELECT,
    replacements
  });

  const messages: MetaBlockedItem[] = rows.map(row => {
    const eligibility = getMetaResendEligibility({
      mediaType: row.mediaType,
      body: row.body,
      deliveryError: row.deliveryError,
      deliveryErrorCode: row.deliveryErrorCode
    });

    return {
      ...row,
      resendEligible: eligibility.eligible,
      resendBlockedReason: eligibility.reason
    };
  });

  return {
    messages,
    totalMessages,
    hasMore: totalMessages > offset + messages.length
  };
};

export default ListMetaBlockedMessagesService;

