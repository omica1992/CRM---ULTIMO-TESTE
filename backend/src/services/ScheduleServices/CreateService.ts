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
  templateMetaId?: string; // ID da QuickMessage (igual campanha) - string para suportar IDs grandes da Meta
  templateName?: string; // Nome (shortcode) do template como usado na API Meta
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
  templateName, // ✅ NOVO: Nome do template para API Meta
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
    
    // ✅ Debug do templateName
    console.log(`📋 [DEBUG-SCHEDULE] ================================================`);
    console.log(`📋 [DEBUG-SCHEDULE] CRIANDO AGENDAMENTO COM TEMPLATE`);
    console.log(`📋 [DEBUG-SCHEDULE] templateName: ${templateName || 'NULL'}`);
    console.log(`📋 [DEBUG-SCHEDULE] templateMetaId: ${templateMetaId || 'NULL'}`);
    console.log(`📋 [DEBUG-SCHEDULE] templateLanguage: ${templateLanguage || 'NULL'}`);
    console.log(`📋 [DEBUG-SCHEDULE] isTemplate: ${isTemplate}`);
    console.log(`📋 [DEBUG-SCHEDULE] tipos: templateName(${typeof templateName}), templateMetaId(${typeof templateMetaId})`);
    
    // Analisar objeto completo dos dados recebidos
    if (isTemplate) {
      console.log(`📋 [DEBUG-SCHEDULE] DADOS JSON COMPLETOS:`);
      console.log(JSON.stringify({
        templateMetaId,
        templateName,
        templateLanguage,
        isTemplate,
        templateComponents: templateComponents ? '[OBJETO COMPLEXO]' : 'NULL'
      }, null, 2));
    }
    
    console.log(`📋 [DEBUG-SCHEDULE] ================================================`);
    
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
      templateMetaId: templateMetaId?.toString() || null, // Garantir que seja string
      templateName: templateName || templateMetaId?.toString() || null, // ✅ NOVO: Nome do template ou ID como fallback
      templateLanguage: templateLanguage || 'pt_BR', // Default para pt_BR se não fornecido
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

  // Log final após criação
  if (schedule.isTemplate) {
    console.log(`💾 [CREATE-SCHEDULE] Agendamento ${schedule.id} criado com sucesso`);
    console.log(`💾 [CREATE-SCHEDULE] templateName salvo: "${schedule.templateName}"`);
    console.log(`💾 [CREATE-SCHEDULE] templateMetaId salvo: "${schedule.templateMetaId}"`);
  }

  return schedule;
};

export default CreateService;
