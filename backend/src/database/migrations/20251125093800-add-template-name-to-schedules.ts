import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Primeiro verificar se a coluna já existe para evitar erros
    try {
      const table = await queryInterface.describeTable("Schedules");
      // Verificar se a propriedade templateName já existe na tabela
      const hasTemplateName = Object.keys(table).includes('templateName');
      
      if (!hasTemplateName) {
        console.log('Adicionando coluna templateName a Schedules');
        await queryInterface.addColumn("Schedules", "templateName", {
          type: DataTypes.STRING,
          allowNull: true
        });
        console.log('Coluna templateName adicionada com sucesso');
      } else {
        console.log('Coluna templateName já existe em Schedules - pulando');
      }
      
      return Promise.resolve();
    } catch (error) {
      console.log('Erro ao verificar/adicionar coluna templateName:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    // Verificar se a coluna existe antes de tentar removê-la
    try {
      const table = await queryInterface.describeTable("Schedules");
      // Verificar se a propriedade templateName existe na tabela
      const hasTemplateName = Object.keys(table).includes('templateName');
      
      if (hasTemplateName) {
        await queryInterface.removeColumn("Schedules", "templateName");
        console.log('Coluna templateName removida com sucesso');
      } else {
        console.log('Coluna templateName não existe - pulando');
      }
      
      return Promise.resolve();
    } catch (error) {
      console.log("Erro ao verificar/remover coluna templateName:", error);
      return Promise.reject(error);
    }
  }
};
