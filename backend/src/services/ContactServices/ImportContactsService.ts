import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import logger from "../../utils/logger";
import Contact from "../../models/Contact";

export async function ImportContactsService(
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let email = "";
    let empresa = "";
    let cpf = "";

    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
      number = `${number}`.replace(/\D/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    if (has(row, "empresa") || has(row, "Empresa") || has(row, "Name Cliente")) {
      empresa = row["empresa"] || row["Empresa"] || row["Name Cliente"];
    }

    if (has(row, "cpf") || has(row, "CPF")) {
      cpf = row["cpf"] || row["CPF"];
      // Remover formatação do CPF se necessário
      cpf = `${cpf}`.replace(/\D/g, "");
    }

    return { name, number, email, empresa, cpf, companyId };
  });


  const contactList: Contact[] = [];

  console.log('=== DEBUG IMPORTAÇÃO DE CONTATOS ===');
  console.log('Total de contatos a processar:', contacts.length);
  if (contacts.length > 0) {
    console.log('Exemplo de primeiro contato:', contacts[0]);
  }

  for (const contact of contacts) {
    console.log(`Processando contato: ${contact.name} | CPF: ${contact.cpf} | Empresa: ${contact.empresa}`);
    
    const [newContact, created] = await Contact.findOrCreate({
      where: {
        number: `${contact.number}`,
        companyId: contact.companyId
      },
      defaults: contact
    });
    
    if (created) {
      console.log(`✅ Contato criado: ID ${newContact.id} | CPF: ${newContact.cpf} | Empresa: ${newContact.empresa}`);
      contactList.push(newContact);
    } else {
      console.log(`ℹ️ Contato já existia: ID ${newContact.id} | CPF atual: ${newContact.cpf} | Empresa atual: ${newContact.empresa}`);
      
      // Atualizar empresa e cpf se o contato já existe mas estava sem esses dados
      if (!newContact.cpf && contact.cpf) {
        await newContact.update({ cpf: contact.cpf });
        console.log(`📝 CPF atualizado para contato ${newContact.id}`);
      }
      if (!newContact.empresa && contact.empresa) {
        await newContact.update({ empresa: contact.empresa });
        console.log(`📝 Empresa atualizada para contato ${newContact.id}`);
      }
    }
  }

  // Verifica se existe os contatos
  // if (contactList) {
  //   for (let newContact of contactList) {
  //     try {
  //       const response = await CheckContactNumber(newContact.number, companyId);
  //       const number = response;
  //       newContact.number = number;
  //       console.log('number', number)
  //       await newContact.save();
  //     } catch (e) {
  //       logger.error(`Número de contato inválido: ${newContact.number}`);
  //     }
  //   }
  // }

  return contactList;
}
