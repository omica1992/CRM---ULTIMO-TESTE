import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.addColumn("CampaignShipping", "sentAt", {
        type: DataTypes.DATE,
        allowNull: true
      }),
      queryInterface.addColumn("CampaignShipping", "metaMessageId", {
        type: DataTypes.STRING,
        allowNull: true
      })
    ]);

    await queryInterface.addIndex("CampaignShipping", ["metaMessageId"], {
      name: "idx_campaign_shipping_meta_message_id"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_meta_message_id"
    );

    await Promise.all([
      queryInterface.removeColumn("CampaignShipping", "sentAt"),
      queryInterface.removeColumn("CampaignShipping", "metaMessageId")
    ]);
  }
};
