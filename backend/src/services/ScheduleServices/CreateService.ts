import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import ScheduleUser from "../../models/ScheduleUser";

interface Request {
  body: string;
  sendAt: string;
  contactId: number | string;
  companyId: number | string;
  userId?: number | string;
  ticketUserId?: number | string;
  userIds?: number[]; // ✅ Novo campo para múltiplos usuários
  queueId?: number | string;
  openTicket?: string;
  statusTicket?: string;
  whatsappId?: number | string;
  intervalo?: number;
  valorIntervalo?: number;
  enviarQuantasVezes?: number;
  tipoDias?: number;
  contadorEnvio?: number;
  assinar?: boolean;
  // ✅ Campos de lembrete
  reminderDate?: string;
  reminderMessage?: string;
  // ✅ Campos de template da API Oficial
  templateMetaId?: number; // ID da QuickMessage (igual campanha)
  templateLanguage?: string;
  templateComponents?: any;
  isTemplate?: boolean;
}

const CreateService = async ({
  body,
  sendAt,
  contactId,
  companyId,
  userId,
  ticketUserId,
  userIds, // ✅ Novo parâmetro
  queueId,
  openTicket,
  statusTicket,
  whatsappId,
  intervalo,
  valorIntervalo,
  enviarQuantasVezes,
  tipoDias,
  assinar,
  contadorEnvio,
  // ✅ Campos de lembrete
  reminderDate,
  reminderMessage,
  // ✅ Campos de template
  templateMetaId,
  templateLanguage,
  templateComponents,
  isTemplate
}: Request): Promise<Schedule> => {
  // ✅ Validação condicional: se for template, body pode ser menor
  const schema = Yup.object().shape({
    body: isTemplate ? Yup.string().optional() : Yup.string().required().min(5),
    sendAt: Yup.string().required()
  });

  try {
    await schema.validate({ body, sendAt });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const schedule = await Schedule.create(
    {
      body,
      sendAt,
      contactId,
      companyId,
      userId,
      status: 'PENDENTE',
      ticketUserId,
      queueId,
      openTicket,
      statusTicket,
      whatsappId,
      intervalo,
      valorIntervalo,
      enviarQuantasVezes,
      tipoDias,
      assinar,
      contadorEnvio,
      // ✅ Incluir campos de lembrete
      reminderDate: reminderDate || null,
      reminderMessage: (reminderDate ? (reminderMessage || body) : null),
      reminderStatus: reminderDate ? 'PENDENTE' : null,
      // ✅ Incluir campos de template
      templateMetaId: templateMetaId || null,
      templateLanguage: templateLanguage || null,
      templateComponents: templateComponents || null,
      isTemplate: isTemplate || false
    }
  );

  // ✅ Criar relacionamentos com múltiplos usuários
  if (userIds && userIds.length > 0) {
    const scheduleUserPromises = userIds.map(userId => 
      ScheduleUser.create({
        scheduleId: schedule.id,
        userId: userId
      })
    );
    await Promise.all(scheduleUserPromises);
  }

  await schedule.reload({
    include: [
      {
        association: "users",
        attributes: ["id", "name", "email"]
      }
    ]
  });

  return schedule;
};

export default CreateService;
