'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Verificar se a coluna já existe
    const tableDescription = await queryInterface.describeTable('Users');
    
    if (!tableDescription.showTemplates) {
      return queryInterface.addColumn('Users', 'showTemplates', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'disabled'
      });
    }
    
    console.log('Coluna showTemplates já existe, pulando...');
    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Users', 'showTemplates');
  }
};
