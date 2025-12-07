import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  companyId: number;
}

const ListQueuesService = async ({ companyId }: Request): Promise<Queue[]> => {
  const queues = await Queue.findAll({
    where: {
      companyId
    },
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
        through: { attributes: [] } // Não incluir dados da tabela intermediária UserQueue
      }
    ],
    order: [["orderQueue", "ASC"]],
  });

  return queues;
};

export default ListQueuesService;
