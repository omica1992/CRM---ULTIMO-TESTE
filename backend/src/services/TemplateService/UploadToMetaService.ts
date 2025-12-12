import axios from "axios";
import AppError from "../../errors/AppError";

interface Request {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  accessToken: string;
  whatsappBusinessAccountId: string;
}

interface Response {
  handle: string;
  uploadSessionId: string;
}

/**
 * Faz upload de mídia usando a Resumable Upload API da Meta
 * Documentação: https://developers.facebook.com/docs/graph-api/guides/upload
 * API Version: v24.0 (2025)
 * 
 * Este é o método CORRETO para obter um handle de mídia para templates
 */
const UploadToMetaService = async ({
  fileBuffer,
  fileName,
  mimeType,
  accessToken,
  whatsappBusinessAccountId
}: Request): Promise<Response> => {
  try {
    console.log(`[UPLOAD TO META] 📤 Iniciando upload para Meta API`);
    console.log(`[UPLOAD TO META] Arquivo: ${fileName}`);
    console.log(`[UPLOAD TO META] Tipo: ${mimeType}`);
    console.log(`[UPLOAD TO META] Tamanho: ${fileBuffer.length} bytes`);
    console.log(`[UPLOAD TO META] WABA ID: ${whatsappBusinessAccountId}`);

    // Passo 1: Criar sessão de upload
    console.log(`[UPLOAD TO META] 🔄 Passo 1: Criando sessão de upload...`);
    
    const sessionPayload = {
      file_length: fileBuffer.length,
      file_type: mimeType,
      access_token: accessToken
    };
    
    console.log(`[UPLOAD TO META] 📋 Payload da sessão:`, JSON.stringify(sessionPayload, null, 2));
    
    const sessionResponse = await axios.post(
      `https://graph.facebook.com/v24.0/${whatsappBusinessAccountId}/uploads`,
      sessionPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[UPLOAD TO META] ✅ Sessão criada com sucesso`);
    console.log(`[UPLOAD TO META] 📋 Resposta da sessão:`, JSON.stringify(sessionResponse.data, null, 2));

    const uploadSessionId = sessionResponse.data.id;
    const handle = sessionResponse.data.h;

    if (!uploadSessionId) {
      throw new AppError("Meta API não retornou ID da sessão de upload", 500);
    }

    // Passo 2: Fazer upload do arquivo
    console.log(`[UPLOAD TO META] 🔄 Passo 2: Fazendo upload do arquivo...`);
    console.log(`[UPLOAD TO META] Upload Session ID: ${uploadSessionId}`);
    
    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v24.0/${uploadSessionId}`,
      fileBuffer,
      {
        headers: {
          'Authorization': `OAuth ${accessToken}`,
          'file_offset': '0',
          'Content-Type': 'application/octet-stream'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    console.log(`[UPLOAD TO META] ✅ Upload concluído com sucesso`);
    console.log(`[UPLOAD TO META] 📋 Resposta do upload:`, JSON.stringify(uploadResponse.data, null, 2));

    // O handle pode vir na resposta da sessão ou do upload
    const finalHandle = handle || uploadResponse.data.h;

    if (!finalHandle) {
      throw new AppError("Meta API não retornou handle da mídia", 500);
    }

    console.log(`[UPLOAD TO META] 🎉 Handle gerado: ${finalHandle}`);

    return {
      handle: finalHandle,
      uploadSessionId
    };
  } catch (error: any) {
    console.error(`[UPLOAD TO META] ❌ Erro no upload:`, error.message);
    
    if (error.response) {
      console.error(`[UPLOAD TO META] Status: ${error.response.status}`);
      console.error(`[UPLOAD TO META] Resposta:`, JSON.stringify(error.response.data, null, 2));
      console.error(`[UPLOAD TO META] Headers:`, JSON.stringify(error.response.headers, null, 2));
    }

    throw new AppError(
      `Erro ao fazer upload para Meta: ${error.response?.data?.error?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

export default UploadToMetaService;
