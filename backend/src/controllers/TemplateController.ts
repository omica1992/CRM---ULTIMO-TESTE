import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import ListTemplatesService from "../services/TemplateService/ListTemplatesService";
import CreateTemplateService from "../services/TemplateService/CreateTemplateService";
import ShowTemplateService from "../services/TemplateService/ShowTemplateService";
import UpdateTemplateService from "../services/TemplateService/UpdateTemplateService";
import DeleteTemplateService from "../services/TemplateService/DeleteTemplateService";
import UploadTemplateMediaService from "../services/TemplateService/UploadTemplateMediaService";
import Whatsapp from "../models/Whatsapp";

interface TemplateData {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: any;
    buttons?: any[];
  }>;
  parameter_format?: 'named' | 'positional';
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId } = req.query;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para acessar templates", 403);
  }

  if (!whatsappId || whatsappId === "null" || whatsappId === "undefined") {
    throw new AppError("WhatsApp ID é obrigatório", 400);
  }

  const whatsappIdNumber = parseInt(whatsappId as string, 10);
  
  if (isNaN(whatsappIdNumber)) {
    throw new AppError("WhatsApp ID inválido", 400);
  }

  const templates = await ListTemplatesService({
    companyId,
    whatsappId: whatsappIdNumber
  });

  return res.json(templates);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const data = req.body as TemplateData;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para criar templates", 403);
  }
  const { whatsappId } = req.params;

  const schema = Yup.object().shape({
    name: Yup.string().required("Nome do template é obrigatório"),
    category: Yup.string()
      .oneOf(['AUTHENTICATION', 'MARKETING', 'UTILITY'])
      .required("Categoria é obrigatória"),
    language: Yup.string().required("Idioma é obrigatório"),
    components: Yup.array()
      .min(1, "Pelo menos um componente é obrigatório")
      .required("Componentes são obrigatórios")
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Validar que tem pelo menos um componente BODY
  const hasBody = data.components.some(comp => comp.type === 'BODY');
  if (!hasBody) {
    throw new AppError("Template deve ter pelo menos um componente BODY");
  }

  const template = await CreateTemplateService({
    ...data,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.status(201).json(template);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId, templateId } = req.params;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para visualizar templates", 403);
  }

  const template = await ShowTemplateService({
    templateId,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json(template);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const data = req.body;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para editar templates", 403);
  }
  const { whatsappId, templateId } = req.params;

  const schema = Yup.object().shape({
    category: Yup.string()
      .oneOf(['AUTHENTICATION', 'MARKETING', 'UTILITY'])
      .optional(),
    components: Yup.array().optional()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const template = await UpdateTemplateService({
    templateId,
    updateData: data,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json(template);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, showTemplates } = req.user;
  const { whatsappId, templateName } = req.params;

  if (showTemplates !== "enabled") {
    throw new AppError("Acesso negado: Você não tem permissão para deletar templates", 403);
  }

  await DeleteTemplateService({
    templateName,
    companyId,
    whatsappId: Number(whatsappId)
  });

  return res.json({ message: "Template removido com sucesso" });
};

export const uploadMedia = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId, showTemplates } = req.user;
    const { uploadToMeta, accessToken, whatsappBusinessAccountId } = req.body;

    console.log(`[UPLOAD MEDIA] CompanyId: ${companyId}, showTemplates: ${showTemplates}`);
    console.log(`[UPLOAD MEDIA] File received:`, req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NO FILE');
    console.log(`[UPLOAD MEDIA] Upload to Meta:`, uploadToMeta === 'true' ? 'SIM' : 'NÃO');
    console.log(`[UPLOAD MEDIA] Access Token:`, accessToken ? `${accessToken.substring(0, 20)}...` : 'NÃO FORNECIDO');
    console.log(`[UPLOAD MEDIA] WABA ID:`, whatsappBusinessAccountId || 'NÃO FORNECIDO');

    // Nota: Removida verificação de showTemplates pois o upload de mídia deve estar disponível
    // para qualquer usuário que tenha acesso aos templates (verificado pelo isAuth)

    if (!req.file) {
      console.log(`[UPLOAD MEDIA] ❌ Nenhum arquivo foi enviado`);
      throw new AppError("Nenhum arquivo foi enviado", 400);
    }

    console.log(`[UPLOAD MEDIA] Processando upload...`);
    const result = await UploadTemplateMediaService({
      file: req.file,
      companyId,
      uploadToMeta: uploadToMeta === 'true',
      accessToken: accessToken || undefined,
      whatsappBusinessAccountId: whatsappBusinessAccountId || undefined
    });

    console.log(`[UPLOAD MEDIA] ✅ Upload concluído: ${result.publicUrl}`);
    if (result.metaHandle) {
      console.log(`[UPLOAD MEDIA] 🎯 Meta Handle gerado: ${result.metaHandle}`);
    }
    
    return res.json(result);
  } catch (error: any) {
    console.error(`[UPLOAD MEDIA] Erro:`, error.message);
    throw error;
  }
};
