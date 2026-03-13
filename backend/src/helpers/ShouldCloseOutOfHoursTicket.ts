import CompaniesSettings from "../models/CompaniesSettings";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";

type CloseDecisionReason =
  | "disabled"
  | "hasAttendant"
  | "pendingWithoutQueue"
  | "botQueue"
  | "notEligible";

interface IShouldCloseOutOfHoursTicketParams {
  ticket: Ticket;
  settings?: CompaniesSettings;
  queue?: Pick<Queue, "id" | "isBotQueue"> | null;
}

interface IShouldCloseOutOfHoursTicketResult {
  shouldClose: boolean;
  reason: CloseDecisionReason;
  isPendingWithoutQueue: boolean;
  isBotQueue: boolean;
}

export const shouldCloseOutOfHoursTicket = async ({
  ticket,
  settings,
  queue
}: IShouldCloseOutOfHoursTicketParams): Promise<IShouldCloseOutOfHoursTicketResult> => {
  if (!settings?.closeTicketOutOfHours) {
    return {
      shouldClose: false,
      reason: "disabled",
      isPendingWithoutQueue: false,
      isBotQueue: false
    };
  }

  if (ticket.userId !== null && ticket.userId !== undefined) {
    return {
      shouldClose: false,
      reason: "hasAttendant",
      isPendingWithoutQueue: false,
      isBotQueue: false
    };
  }

  const isPendingWithoutQueue = ticket.status === "pending" && !ticket.queueId;
  let isBotQueue = false;

  if (typeof queue?.isBotQueue === "boolean") {
    isBotQueue = queue.isBotQueue;
  } else if (typeof ticket.queue?.isBotQueue === "boolean") {
    isBotQueue = ticket.queue.isBotQueue;
  } else if (ticket.queueId) {
    const dbQueue = await Queue.findByPk(ticket.queueId, {
      attributes: ["id", "isBotQueue"]
    });
    isBotQueue = !!dbQueue?.isBotQueue;
  }

  if (isPendingWithoutQueue) {
    return {
      shouldClose: true,
      reason: "pendingWithoutQueue",
      isPendingWithoutQueue,
      isBotQueue
    };
  }

  if (isBotQueue) {
    return {
      shouldClose: true,
      reason: "botQueue",
      isPendingWithoutQueue,
      isBotQueue
    };
  }

  return {
    shouldClose: false,
    reason: "notEligible",
    isPendingWithoutQueue,
    isBotQueue
  };
};
