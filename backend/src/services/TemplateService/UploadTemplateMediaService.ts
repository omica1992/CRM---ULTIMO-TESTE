import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import UploadToMetaService from "./UploadToMetaService";

interface Request {
  file: Express.Multer.File;
  companyId: number;
  uploadToMeta?: boolean; // Se true, faz upload para Meta API via api_oficial
  whatsappToken?: string; // Token do whatsapp para identificar conexão no api_oficial
}

interface Response {
  publicUrl: string;
  filename: string;
  path: string;
  metaHandle?: string; // Handle gerado pela Meta (se uploadToMeta = true)
}

const UploadTemplateMediaService = async ({
  file,
  companyId,
  uploadToMeta = false,
  whatsappToken
}: Request): Promise<Response> => {
  try {
    console.log(`[UPLOAD SERVICE] Iniciando upload - File: ${file.originalname}, Type: ${file.mimetype}, Size: ${file.size}`);
    
    // Validar tipo de arquivo
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(`[UPLOAD SERVICE] ❌ Tipo de arquivo não suportado: ${file.mimetype}`);
      throw new AppError(
        "Tipo de arquivo não suportado. Use: JPEG, PNG, GIF, WEBP, MP4 ou PDF",
        400
      );
    }
    
    console.log(`[UPLOAD SERVICE] ✅ Tipo de arquivo válido`);


    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new AppError("Arquivo muito grande. Tamanho máximo: 5MB", 400);
    }

    // Criar diretório se não existir
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "public",
      "template-media",
      String(companyId)
    );

    if (!fsSync.existsSync(uploadDir)) {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = path.extname(file.originalname);
    const filename = `template_${timestamp}_${randomString}${extension}`;
    const filePath = path.join(uploadDir, filename);

    // Salvar arquivo
    await fs.writeFile(filePath, file.buffer as any);

    // ✅ CORREÇÃO: Gerar URL pública com HTTPS (Meta API exige)
    let baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    
    // Se for localhost, alertar que precisa usar HTTPS em produção
    if (baseUrl.startsWith('http://localhost') || baseUrl.startsWith('http://127.0.0.1')) {
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ ATENÇÃO: URL localhost detectada. Templates com mídia NÃO funcionarão!`);
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ Configure BACKEND_URL com domínio HTTPS no .env`);
      console.warn(`[UPLOAD TEMPLATE MEDIA] ⚠️ Exemplo: BACKEND_URL=https://seu-dominio.com`);
    }
    
    // Garantir que URL usa HTTPS (exceto localhost para desenvolvimento)
    if (!baseUrl.startsWith('http://localhost') && !baseUrl.startsWith('http://127.0.0.1')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
    
    const publicUrl = `${baseUrl}/public/template-media/${companyId}/${filename}`;

    console.log(`[UPLOAD TEMPLATE MEDIA] Arquivo salvo: ${filename}`);
    console.log(`[UPLOAD TEMPLATE MEDIA] URL pública: ${publicUrl}`);

    let metaHandle: string | undefined;

    if (uploadToMeta && !whatsappToken) {
      throw new AppError(
        "Token da conexao nao informado para gerar o handle da Meta",
        400
      );
    }

    // Se solicitado, fazer upload para Meta API via api_oficial
    if (uploadToMeta && whatsappToken) {
      console.log(`[UPLOAD TEMPLATE MEDIA] 🚀 Fazendo upload para Meta API via api_oficial...`);
      
      try {
        const metaUploadResult = await UploadToMetaService({
          fileBuffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          whatsappToken
        });
        
        metaHandle = metaUploadResult.handle;
        console.log(`[UPLOAD TEMPLATE MEDIA] ✅ Upload para Meta concluído - Handle: ${metaHandle}`);
      } catch (error: any) {
        console.error(`[UPLOAD TEMPLATE MEDIA] ❌ Erro ao fazer upload para Meta:`, error.message);
        console.error(`[UPLOAD TEMPLATE MEDIA] Stack trace:`, error.stack);
        if (error.response) {
          console.error(`[UPLOAD TEMPLATE MEDIA] Resposta:`, JSON.stringify(error.response.data, null, 2));
        }
        throw new AppError(
          `Nao foi possivel gerar o handle da Meta para a midia: ${error.message}`,
          error.statusCode || error.response?.status || 500
        );
      }
    } else {
      console.log(`[UPLOAD TEMPLATE MEDIA] ℹ️ Upload para Meta não solicitado ou token faltando:`, {
        uploadToMeta,
        hasWhatsappToken: !!whatsappToken
      });
    }

    return {
      publicUrl,
      filename,
      path: filePath,
      metaHandle
    };
  } catch (error: any) {
    console.error("[UPLOAD TEMPLATE MEDIA] Erro:", error);
    throw new AppError(
      `Erro ao fazer upload: ${error.message}`,
      error.statusCode || 500
    );
  }
};

export default UploadTemplateMediaService;
