import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verificar se a coluna já existe
    const tableDescription: any = await queryInterface.describeTable('CompaniesSettings');
    
    if (!tableDescription.closeTicketOnFlowExit) {
      return queryInterface.addColumn("CompaniesSettings", "closeTicketOnFlowExit", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    
    console.log('Coluna closeTicketOnFlowExit já existe, pulando...');
    return Promise.resolve();
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("CompaniesSettings", "closeTicketOnFlowExit");
  }
};
