jest.mock("../../../models/CampaignShipping", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  __esModule: true,
  getIO: jest.fn()
}));

jest.mock("../../../queues", () => ({
  __esModule: true,
  scheduleCampaignFinalizeCheck: jest.fn()
}));

import CampaignShipping from "../../../models/CampaignShipping";
import { getIO } from "../../../libs/socket";
import { scheduleCampaignFinalizeCheck } from "../../../queues";
import SyncCampaignShippingMetaStatusService from "../SyncCampaignShippingMetaStatusService";

describe("SyncCampaignShippingMetaStatusService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should mark shipping as delivered when meta sends delivered status", async () => {
    const emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue({
      of: jest.fn(() => ({ emit }))
    });

    const shipping: any = {
      id: 10,
      campaignId: 99,
      campaign: { id: 99, companyId: 1 },
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      errorMessage: null,
      metaMessageId: "wamid.123",
      update: jest.fn().mockImplementation(function (payload) {
        Object.assign(shipping, payload);
        return shipping;
      })
    };

    (CampaignShipping.findOne as jest.Mock).mockResolvedValue(shipping);

    await SyncCampaignShippingMetaStatusService({
      companyId: 1,
      messageId: "wamid.123",
      status: "delivered"
    });

    expect(shipping.update).toHaveBeenCalled();
    expect(shipping.deliveredAt).toBeTruthy();
    expect(shipping.sentAt).toBeTruthy();
    expect(scheduleCampaignFinalizeCheck).toHaveBeenCalledWith(99);
    expect(emit).toHaveBeenCalled();
  });

  it("should register failure reason when meta sends failed status", async () => {
    const emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue({
      of: jest.fn(() => ({ emit }))
    });

    const shipping: any = {
      id: 11,
      campaignId: 77,
      campaign: { id: 77, companyId: 2 },
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      errorMessage: null,
      metaMessageId: "wamid.456",
      update: jest.fn().mockImplementation(function (payload) {
        Object.assign(shipping, payload);
        return shipping;
      })
    };

    (CampaignShipping.findOne as jest.Mock).mockResolvedValue(shipping);

    await SyncCampaignShippingMetaStatusService({
      companyId: 2,
      messageId: "wamid.456",
      status: "failed",
      error: {
        error_data: {
          details: "Business eligibility payment issue"
        }
      }
    });

    expect(shipping.update).toHaveBeenCalled();
    expect(shipping.sentAt).toBeTruthy();
    expect(shipping.failedAt).toBeTruthy();
    expect(shipping.errorMessage).toBe("Business eligibility payment issue");
    expect(scheduleCampaignFinalizeCheck).toHaveBeenCalledWith(77);
    expect(emit).toHaveBeenCalled();
  });
});
