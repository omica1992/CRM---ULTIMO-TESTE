import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      // Verificar se a coluna já existe
      const tableInfo: Record<string, any> = await queryInterface.describeTable("Users");
      
      // Se a coluna não existir, criá-la
      if (!tableInfo.showTemplates) {
        console.log('Criando coluna showTemplates na tabela Users');
        return queryInterface.addColumn("Users", "showTemplates", {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "disabled"
        });
      } else {
        console.log('Coluna showTemplates já existe na tabela Users - pulando migração');
        return Promise.resolve();
      }
    } catch (error) {
      console.error('Erro ao verificar/criar coluna:', error);
      return Promise.reject(error);
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "showTemplates");
  }
};
