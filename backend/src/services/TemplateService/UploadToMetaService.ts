import axios from "axios";
import FormData from "form-data";
import AppError from "../../errors/AppError";

interface Request {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  whatsappToken: string; // Token do whatsapp (usado para identificar a conexão no api_oficial)
}

interface Response {
  handle: string;
  uploadSessionId: string;
}

/**
 * Faz upload de mídia usando o api_oficial que gerencia as credenciais corretas
 * O api_oficial usa o waba_id e send_token corretos do próprio banco de dados
 * 
 * Este é o método CORRETO para obter um handle de mídia para templates
 */
const UploadToMetaService = async ({
  fileBuffer,
  fileName,
  mimeType,
  whatsappToken
}: Request): Promise<Response> => {
  try {
    console.log(`[UPLOAD TO META] 📤 Iniciando upload via API Oficial`);
    console.log(`[UPLOAD TO META] Arquivo: ${fileName}`);
    console.log(`[UPLOAD TO META] Tipo: ${mimeType}`);
    console.log(`[UPLOAD TO META] Tamanho: ${fileBuffer.length} bytes`);
    console.log(`[UPLOAD TO META] Token: ${whatsappToken}`);

    // Criar FormData para enviar o arquivo
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });

    const apiOficialUrl = process.env.URL_API_OFICIAL || 'http://localhost:3005';
    const uploadUrl = `${apiOficialUrl}/v1/templates-whatsapp/upload-media/${whatsappToken}`;

    console.log(`[UPLOAD TO META] 🔄 Enviando para: ${uploadUrl}`);

    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.TOKEN_API_OFICIAL}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    console.log(`[UPLOAD TO META] ✅ Upload concluído com sucesso`);
    console.log(`[UPLOAD TO META] 📋 Resposta:`, JSON.stringify(response.data, null, 2));

    const { handle, uploadSessionId } = response.data;

    if (!handle) {
      throw new AppError("API Oficial não retornou handle da mídia", 500);
    }

    console.log(`[UPLOAD TO META] 🎉 Handle gerado: ${handle}`);

    return {
      handle,
      uploadSessionId
    };
  } catch (error: any) {
    console.error(`[UPLOAD TO META] ❌ Erro no upload:`, error.message);
    
    if (error.response) {
      console.error(`[UPLOAD TO META] Status: ${error.response.status}`);
      console.error(`[UPLOAD TO META] Resposta:`, JSON.stringify(error.response.data, null, 2));
    }

    throw new AppError(
      `Erro ao fazer upload via API Oficial: ${error.response?.data?.message || error.message}`,
      error.response?.status || 500
    );
  }
};

export default UploadToMetaService;
