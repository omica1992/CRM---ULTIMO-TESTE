import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Verificar se a coluna já existe
    const tableDescription: any = await queryInterface.describeTable('CompaniesSettings');
    
    if (!tableDescription.closeTicketOutOfHours) {
      return queryInterface.addColumn("CompaniesSettings", "closeTicketOutOfHours", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    
    console.log('Coluna closeTicketOutOfHours já existe, pulando...');
    return Promise.resolve();
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("CompaniesSettings", "closeTicketOutOfHours");
  }
};
