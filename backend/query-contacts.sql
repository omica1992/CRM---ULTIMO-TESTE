-- Query para comparar os dois contatos
SELECT 
  name, 
  number, 
  "remoteJid", 
  lid, 
  "isGroup", 
  active, 
  channel, 
  email, 
  empresa, 
  cpf,
  "createdAt",
  "updatedAt"
FROM "Contacts" 
WHERE number IN ('555384127035', '555381161829')
ORDER BY number;
