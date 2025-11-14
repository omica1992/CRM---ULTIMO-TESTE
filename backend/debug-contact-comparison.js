// Script para comparar os dois contatos e identificar a diferença
const { Sequelize } = require('sequelize');

// Configuração do banco - ajuste conforme seu .env
const sequelize = new Sequelize({
  dialect: 'postgres', // ou 'mysql' se for MySQL
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whaticket',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  logging: false
});

async function compareContacts() {
  console.log('🔍 Comparando os dois contatos...\n');
  
  try {
    // Query SQL direta para comparar os contatos
    const [results] = await sequelize.query(`
      SELECT 
        name, number, "remoteJid", lid, "isGroup", active, channel, email, empresa, cpf, id
      FROM "Contacts" 
      WHERE number IN ('555384127035', '555381161829')
      ORDER BY number;
    `);

    if (results.length === 0) {
      console.log('❌ Nenhum contato encontrado!');
      return;
    }

    const workingContact = results.find(c => c.number === '555384127035');
    const problemContact = results.find(c => c.number === '555381161829');

    console.log('📊 COMPARAÇÃO DE CONTATOS:\n');
    
    if (workingContact) {
      console.log('✅ CONTATO QUE FUNCIONA:');
      console.log('  Nome:', workingContact?.name || 'N/A');
      console.log('  Número:', workingContact?.number || 'N/A');
      console.log('  RemoteJid:', workingContact?.remoteJid || 'N/A');
      console.log('  LID:', workingContact?.lid || 'N/A');
      console.log('  IsGroup:', workingContact?.isGroup || 'N/A');
      console.log('  Active:', workingContact?.active || 'N/A');
      console.log('  Channel:', workingContact?.channel || 'N/A');
      console.log('  Email:', workingContact?.email || 'N/A');
      console.log('  Empresa:', workingContact?.empresa || 'N/A');
      console.log('  CPF:', workingContact?.cpf || 'N/A');
    }
    
    if (problemContact) {
      console.log('\n❌ CONTATO COM PROBLEMA:');
      console.log('  Nome:', problemContact?.name || 'N/A');
      console.log('  Número:', problemContact?.number || 'N/A');
      console.log('  RemoteJid:', problemContact?.remoteJid || 'N/A');
      console.log('  LID:', problemContact?.lid || 'N/A');
      console.log('  IsGroup:', problemContact?.isGroup || 'N/A');
      console.log('  Active:', problemContact?.active || 'N/A');
      console.log('  Channel:', problemContact?.channel || 'N/A');
      console.log('  Email:', problemContact?.email || 'N/A');
      console.log('  Empresa:', problemContact?.empresa || 'N/A');
      console.log('  CPF:', problemContact?.cpf || 'N/A');
    }

    console.log('\n🔍 DIFERENÇAS ENCONTRADAS:');
    
    if (!workingContact) {
      console.log('⚠️  Contato que funciona não foi encontrado!');
    }
    
    if (!problemContact) {
      console.log('⚠️  Contato com problema não foi encontrado!');
    }

    if (workingContact && problemContact) {
      const fields = ['name', 'number', 'remoteJid', 'lid', 'isGroup', 'active', 'channel', 'email', 'empresa', 'cpf'];
      
      let foundDifferences = false;
      fields.forEach(field => {
        const working = workingContact[field];
        const problem = problemContact[field];
        
        if (working !== problem) {
          console.log(`  📍 ${field}: '${working}' vs '${problem}'`);
          foundDifferences = true;
        }
      });
      
      if (!foundDifferences) {
        console.log('  ⚠️  Nenhuma diferença óbvia encontrada nos campos principais!');
      }
    }
    
    // Verificar tickets associados
    if (workingContact) {
      const [ticketResults] = await sequelize.query(`SELECT COUNT(*) as count FROM "Tickets" WHERE "contactId" = ${workingContact.id}`);
      console.log(`\n📋 Tickets do contato que funciona: ${ticketResults[0].count}`);
    }
    
    if (problemContact) {
      const [ticketResults] = await sequelize.query(`SELECT COUNT(*) as count FROM "Tickets" WHERE "contactId" = ${problemContact.id}`);
      console.log(`📋 Tickets do contato com problema: ${ticketResults[0].count}`);
    }

  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n✅ Análise concluída!');
  }
}

// Executar
compareContacts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
