import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getWbot } from "../../libs/wbot";
import { getIO } from "../../libs/socket";
import { formatPhoneNumber } from "../../utils/phoneFormatter";

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  logger.info(`[ImportContacts] Iniciando importação: ${rows.length} contatos para lista ${contactListId}`);

  const contacts = rows.map((row, index) => {
    let name = "";
    let number = "";
    let email = "";
    let importError = null;

    // Extrair nome
    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    // Extrair e formatar número
    let rawNumber = "";
    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número") ||
      has(row, "telefone") ||
      has(row, "Telefone")
    ) {
      rawNumber = row["numero"] || row["número"] || row["Numero"] || row["Número"] || row["telefone"] || row["Telefone"];
    }

    // Formatar número usando função centralizada
    if (rawNumber) {
      try {
        number = formatPhoneNumber(rawNumber);
        logger.debug(`[ImportContacts] Número formatado: ${rawNumber} → ${number}`);
      } catch (error) {
        importError = error.message;
        logger.warn(`[ImportContacts] Erro ao formatar número na linha ${index + 2}: ${rawNumber} - ${error.message}`);
      }
    } else {
      importError = "Número não encontrado na linha";
      logger.warn(`[ImportContacts] Número não encontrado na linha ${index + 2}`);
    }

    // Extrair email
    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    return { name, number, email, contactListId, companyId, importError, rawInput: rawNumber };
  });

  const contactList: ContactListItem[] = [];
  const errorList: any[] = [];

  // Inserir contatos
  for (const contact of contacts) {
    if (contact.importError) {
      errorList.push({
        nome: contact.name,
        numero: contact.rawInput,
        erro: contact.importError
      });
      continue;
    }

    if (!contact.number) {
      errorList.push({
        nome: contact.name,
        numero: contact.rawInput,
        erro: "Número vazio após formatação"
      });
      continue;
    }

    try {
      const { importError: _err, rawInput: _raw, ...contactData } = contact;
      const [newContact, created] = await ContactListItem.findOrCreate({
        where: {
          number: `${contact.number}`,
          contactListId: contact.contactListId,
          companyId: contact.companyId
        },
        defaults: contactData
      });

      if (created) {
        logger.info(`[ImportContacts] Contato criado: ${contact.name} (${contact.number})`);
        contactList.push(newContact);
      } else {
        logger.debug(`[ImportContacts] Contato já existia: ${contact.name} (${contact.number})`);
      }
    } catch (error) {
      errorList.push({
        nome: contact.name,
        numero: contact.number,
        erro: error.message
      });
      logger.error(`[ImportContacts] Erro ao criar contato ${contact.name}: ${error.message}`);
    }
  }

  // Validar contatos com WhatsApp
  if (contactList && contactList.length > 0) {
    logger.info(`[ImportContacts] Validando ${contactList.length} contatos com WhatsApp...`);

    for (let newContact of contactList) {
      try {
        // Buscar conexão: tentar Baileys primeiro, depois API Oficial
        let whatsapp = await Whatsapp.findOne({
          where: { companyId, status: 'CONNECTED', channel: 'whatsapp' },
          limit: 1
        });

        // Se não encontrar Baileys, tentar API Oficial
        if (!whatsapp) {
          logger.debug(`[ImportContacts] Baileys não encontrado, tentando API Oficial...`);
          whatsapp = await Whatsapp.findOne({
            where: { companyId, status: 'CONNECTED', channel: 'whatsapp_oficial' },
            limit: 1
          });
        }

        if (!whatsapp) {
          logger.warn(`[ImportContacts] Nenhuma conexão WhatsApp encontrada para validação`);
          newContact.isWhatsappValid = false;
          await newContact.save();
          continue;
        }

        // Para API Oficial, não validar com wbot (ele não existe)
        if (whatsapp.channel === 'whatsapp_oficial') {
          logger.debug(`[ImportContacts] Usando API Oficial, marcando como válido: ${newContact.number}`);
          newContact.isWhatsappValid = true;
          await newContact.save();
          continue;
        }

        // Para Baileys, validar com onWhatsApp
        try {
          const wbot = getWbot(whatsapp.id);
          const response = await wbot.onWhatsApp(`${newContact.number}@s.whatsapp.net`);

          newContact.isWhatsappValid = response[0]?.exists ? true : false;
          if (response[0]?.exists) {
            newContact.number = response[0]?.jid.split("@")[0];
          }

          logger.info(`[ImportContacts] Validação concluída para ${newContact.number}: ${newContact.isWhatsappValid ? 'Válido' : 'Inválido'}`);
          await newContact.save();
        } catch (wbotError) {
          logger.warn(`[ImportContacts] Erro ao validar com wbot: ${wbotError.message}, marcando como inválido`);
          newContact.isWhatsappValid = false;
          await newContact.save();
        }
      } catch (error) {
        logger.error(`[ImportContacts] Erro ao validar contato ${newContact.number}: ${error.message}`);
        newContact.isWhatsappValid = false;
        await newContact.save();
      }

      // Emitir atualização
      const io = getIO();
      io.of(String(companyId))
        .emit(`company-${companyId}-ContactListItem-${+contactListId}`, {
          action: "reload",
          records: [newContact]
        });
    }
  }

  // Log final
  logger.info(`[ImportContacts] Importação finalizada: ${contactList.length} contatos criados, ${errorList.length} erros`);

  if (errorList.length > 0) {
    logger.warn(`[ImportContacts] Erros de importação:`, JSON.stringify(errorList, null, 2));
  }

  // Emitir evento final para forçar reload completo no frontend
  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-ContactListItem-${+contactListId}`, {
      action: "reload",
      records: contactList
    });

  logger.info(`[ImportContacts] Evento de reload emitido para o frontend`);

  return contactList;
}
