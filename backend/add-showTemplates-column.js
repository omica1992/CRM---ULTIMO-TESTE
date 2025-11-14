const { QueryInterface, DataTypes } = require('sequelize');
const { sequelize } = require('./dist/database');

async function addShowTemplatesColumn() {
  try {
    console.log('🔄 Verificando se a coluna showTemplates existe...');
    
    const tableDescription = await sequelize.getQueryInterface().describeTable('Users');
    
    if (tableDescription.showTemplates) {
      console.log('✅ Coluna showTemplates já existe!');
      process.exit(0);
    }
    
    console.log('🔧 Adicionando coluna showTemplates...');
    
    await sequelize.getQueryInterface().addColumn('Users', 'showTemplates', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'disabled'
    });
    
    console.log('✅ Coluna showTemplates adicionada com sucesso!');
    
    // Atualizar usuários existentes
    await sequelize.query('UPDATE "Users" SET "showTemplates" = \'disabled\' WHERE "showTemplates" IS NULL');
    console.log('✅ Usuários existentes atualizados!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    process.exit(1);
  }
}

addShowTemplatesColumn();
