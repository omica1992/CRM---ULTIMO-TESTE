import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      // Verificar quais colunas já existem
      const tableInfo: Record<string, any> = await queryInterface.describeTable("Campaigns");
      const promises = [];

      // Alterar templateId de INTEGER para STRING (se existir)
      if (tableInfo.templateId) {
        console.log('Alterando coluna templateId para STRING');
        promises.push(
          queryInterface.changeColumn("Campaigns", "templateId", {
            type: DataTypes.STRING,
            allowNull: true
          })
        );
      } else {
        console.log('Coluna templateId não existe - pulando');
      }
      
      // Adicionar novos campos de template Meta (apenas se não existirem)
      if (!tableInfo.templateName) {
        console.log('Adicionando coluna templateName');
        promises.push(
          queryInterface.addColumn("Campaigns", "templateName", {
            type: DataTypes.STRING,
            allowNull: true
          })
        );
      } else {
        console.log('Coluna templateName já existe - pulando');
      }
      
      if (!tableInfo.templateLanguage) {
        console.log('Adicionando coluna templateLanguage');
        promises.push(
          queryInterface.addColumn("Campaigns", "templateLanguage", {
            type: DataTypes.STRING,
            allowNull: true
          })
        );
      } else {
        console.log('Coluna templateLanguage já existe - pulando');
      }
      
      if (!tableInfo.templateComponents) {
        console.log('Adicionando coluna templateComponents');
        promises.push(
          queryInterface.addColumn("Campaigns", "templateComponents", {
            type: DataTypes.JSON,
            allowNull: true
          })
        );
      } else {
        console.log('Coluna templateComponents já existe - pulando');
      }

      // Executar todas as alterações que precisam ser feitas
      if (promises.length > 0) {
        return Promise.all(promises);
      } else {
        console.log('Todas as colunas já existem - nenhuma alteração necessária');
        return Promise.resolve();
      }
    } catch (error) {
      console.error('Erro ao modificar tabela Campaigns:', error);
      return Promise.reject(error);
    }
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      // Reverter templateId para INTEGER
      queryInterface.changeColumn("Campaigns", "templateId", {
        type: DataTypes.INTEGER,
        allowNull: true
      }),
      
      // Remover campos adicionados
      queryInterface.removeColumn("Campaigns", "templateName"),
      queryInterface.removeColumn("Campaigns", "templateLanguage"),
      queryInterface.removeColumn("Campaigns", "templateComponents")
    ]);
  }
};
