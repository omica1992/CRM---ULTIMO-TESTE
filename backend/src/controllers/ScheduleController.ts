import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/ScheduleServices/CreateService";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";
import Schedule from "../models/Schedule";

import path from "path";
import fs from "fs";
import { head } from "lodash";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { schedules, count, hasMore } = await ListService({
    searchParam,
    contactId,
    userId,
    pageNumber,
    companyId
  });

  return res.json({ schedules, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    body,
    sendAt,
    contactId,
    userId,
    ticketUserId,
    userIds, // ✅ Novo campo para múltiplos usuários
    queueId,
    openTicket,
    statusTicket,
    whatsappId,
    intervalo = 1,
		valorIntervalo = 0,
		enviarQuantasVezes = 1,
		tipoDias=  4,
    contadorEnvio = 0,
    assinar = false,
    // ✅ Campos de lembrete
    reminderDate,
    reminderMessage,
    // ✅ Campos de template da API Oficial
    templateMetaId,
    templateName,  // ✅ Extrair templateName explicitamente
    templateLanguage,
    templateComponents,
    isTemplate
  } = req.body;
  const { companyId } = req.user;

  // ✅ Log para debug de templates
  if (isTemplate) {
    console.log(`📋 [CONTROLLER-CREATE] ================================================`);
    console.log("📋 [CONTROLLER-CREATE] Template detectado!");
    console.log("📋 [CONTROLLER-CREATE] Valores recebidos:");
    console.log(` - templateMetaId: "${templateMetaId || ''}" (${typeof templateMetaId})`);
    console.log(` - templateName: "${templateName || ''}" (${typeof templateName})`);
    console.log(` - templateLanguage: "${templateLanguage || ''}"`);
    console.log(` - isTemplate: ${isTemplate}`);
    console.log(` - hasComponents: ${!!templateComponents}`);
    
    // Verificar se templateName está sendo enviado corretamente
    if (!templateName) {
      console.log(`⚠️ [CONTROLLER-CREATE] ALERTA: templateName NÃO recebido ou está vazio!`);
    } else {
      console.log(`✅ [CONTROLLER-CREATE] templateName recebido corretamente: "${templateName}"`);
    }
    
    console.log(`📋 [CONTROLLER-CREATE] ================================================`);
  }

  const schedule = await CreateService({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    ticketUserId,
    userIds, // ✅ Incluir múltiplos usuários
    queueId,
    openTicket,
    statusTicket,
    whatsappId,
    intervalo,
    valorIntervalo,
    enviarQuantasVezes,
    tipoDias,
    contadorEnvio,
    assinar,
    // ✅ Incluir campos de lembrete
    reminderDate,
    reminderMessage,
    // ✅ Incluir campos de template
    templateMetaId,
    templateName, // ✅ Usar variável já extraída
    templateLanguage,
    templateComponents,
    isTemplate
  });

  const io = getIO();
  io.of(String(companyId))
  .emit(`company${companyId}-schedule`, {
    action: "create",
    schedule
  });

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData = req.body;
  const { companyId } = req.user;
  
  // ✅ Log para debug de templates na atualização
  if (scheduleData.isTemplate) {
    console.log(`📋 [CONTROLLER-UPDATE] ================================================`);
    console.log(`📋 [CONTROLLER-UPDATE] Atualizando Schedule ID ${scheduleId} com template`);
    console.log(`📋 [CONTROLLER-UPDATE] Valores recebidos:`);
    console.log(` - templateMetaId: "${scheduleData.templateMetaId || ''}" (${typeof scheduleData.templateMetaId})`);
    console.log(` - templateName: "${scheduleData.templateName || ''}" (${typeof scheduleData.templateName})`);
    console.log(` - templateLanguage: "${scheduleData.templateLanguage || ''}"`);
    console.log(` - isTemplate: ${scheduleData.isTemplate}`);
    console.log(` - hasComponents: ${!!scheduleData.templateComponents}`);
    
    // Verificar se templateName está sendo enviado corretamente
    if (!scheduleData.templateName) {
      console.log(`⚠️ [CONTROLLER-UPDATE] ALERTA: templateName NÃO recebido no corpo da requisição!`);
    }
    
    console.log(`📋 [CONTROLLER-UPDATE] ================================================`);
  }

  const schedule = await UpdateService({ scheduleData, id: scheduleId, companyId });

  const io = getIO();
  io.of(String(companyId))
  .emit(`company${companyId}-schedule`, {
    action: "update",
    schedule
  });

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.of(String(companyId))
  .emit(`company${companyId}-schedule`, {
    action: "delete",
    scheduleId
  });

  return res.status(200).json({ message: "Schedule deleted" });
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const schedule = await Schedule.findByPk(id);
    schedule.mediaPath = file.filename;
    schedule.mediaName = file.originalname;

    await schedule.save();
    return res.send({ mensagem: "Arquivo Anexado" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const schedule = await Schedule.findByPk(id);
    const filePath = path.resolve("public", schedule.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }
    schedule.mediaPath = null;
    schedule.mediaName = null;
    await schedule.save();
    return res.send({ mensagem: "Arquivo Excluído" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};