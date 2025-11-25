import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Schedule from "../../models/Schedule";
import ScheduleUser from "../../models/ScheduleUser";
import ShowService from "./ShowService";

interface ScheduleData {
  id?: number;
  body?: string;
  sendAt?: string;
  sentAt?: string;
  contactId?: number;
  companyId?: number;
  ticketId?: number;
  userId?: number;
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
  assinar?: boolean;
  // ✅ Campos de lembrete
  reminderDate?: string;
  reminderMessage?: string;
  // ✅ Campos de template da API Oficial
  templateMetaId?: string; // ID da QuickMessage (igual campanha) - string para suportar IDs grandes da Meta
  templateName?: string; // ✅ NOVO: Nome do template para API Meta
  templateLanguage?: string;
  templateComponents?: any;
  isTemplate?: boolean;
}

interface Request {
  scheduleData: ScheduleData;
  id: string | number;
  companyId: number;
}

const UpdateUserService = async ({
  scheduleData,
  id,
  companyId
}: Request): Promise<Schedule | undefined> => {
  const schedule = await ShowService(id, companyId);

  if (schedule?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  const schema = Yup.object().shape({
    body: Yup.string().min(5)
  });

  const {
    body,
    sendAt,
    sentAt,
    contactId,
    ticketId,
    userId,
    ticketUserId,
    userIds, // ✅ Novo campo
    queueId,
    openTicket,
    statusTicket,
    whatsappId,
    intervalo,
    valorIntervalo,
    enviarQuantasVezes,
    tipoDias,
    assinar,
    // ✅ Campos de lembrete
    reminderDate,
    reminderMessage,
    // ✅ Campos de template
    templateMetaId,
    templateName, // ✅ NOVO: Nome do template para API Meta
    templateLanguage,
    templateComponents,
    isTemplate
  } = scheduleData;

  try {
    await schema.validate({ body });
    
    // ✅ Debug do templateName em atualização
    if (isTemplate) {
      console.log(`📋 [DEBUG-UPDATE] ================================================`);
      console.log(`📋 [DEBUG-UPDATE] ATUALIZANDO AGENDAMENTO COM TEMPLATE`);
      console.log(`📋 [DEBUG-UPDATE] ID: ${id}`);
      console.log(`📋 [DEBUG-UPDATE] templateName: ${templateName || 'NULL'}`);
      console.log(`📋 [DEBUG-UPDATE] templateMetaId: ${templateMetaId || 'NULL'}`);
      console.log(`📋 [DEBUG-UPDATE] templateLanguage: ${templateLanguage || 'NULL'}`);
      console.log(`📋 [DEBUG-UPDATE] tipos: templateName(${typeof templateName}), templateMetaId(${typeof templateMetaId})`);
      
      // Analisar objeto completo dos dados recebidos
      console.log(`📋 [DEBUG-UPDATE] DADOS JSON COMPLETOS:`);
      console.log(JSON.stringify({
        templateMetaId,
        templateName,
        templateLanguage,
        isTemplate,
        templateComponents: templateComponents ? '[OBJETO COMPLEXO]' : 'NULL'
      }, null, 2));
      
      console.log(`📋 [DEBUG-UPDATE] ================================================`);
    }
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await schedule.update({
    body,
    sendAt,
    sentAt,
    contactId,
    ticketId,
    userId,
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
    // ✅ Incluir campos de lembrete
    reminderDate: reminderDate || null,
    reminderMessage: (reminderDate ? (reminderMessage || body) : null),
    reminderStatus: reminderDate ? 'PENDENTE' : null,
    // ✅ Incluir campos de template
    templateMetaId: templateMetaId?.toString() || null, // Garantir que seja string
    templateName: templateName || templateMetaId?.toString() || null, // ✅ NOVO: Nome do template ou ID como fallback
    templateLanguage: templateLanguage || 'pt_BR', // Default para pt_BR se não fornecido
    templateComponents: templateComponents || null,
    isTemplate: isTemplate || false
  });

  // ✅ Log detalhado após update
if (schedule.isTemplate) {
  console.log(`💾 [UPDATE-SCHEDULE] Agendamento ${schedule.id} atualizado com sucesso`);
  console.log(`💾 [UPDATE-SCHEDULE] templateName salvo: "${schedule.templateName}"`);
  console.log(`💾 [UPDATE-SCHEDULE] templateMetaId salvo: "${schedule.templateMetaId}"`);
  console.log(`💾 [UPDATE-SCHEDULE] isTemplate: ${schedule.isTemplate}`);
}

  // ✅ Atualizar relacionamentos com múltiplos usuários
  if (userIds !== undefined) {
    // Remover relacionamentos existentes
    await ScheduleUser.destroy({
      where: { scheduleId: schedule.id }
    });

    // Criar novos relacionamentos
    if (userIds.length > 0) {
      const scheduleUserPromises = userIds.map(userId => 
        ScheduleUser.create({
          scheduleId: schedule.id,
          userId: userId
        })
      );
      await Promise.all(scheduleUserPromises);
    }
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

export default UpdateUserService;
