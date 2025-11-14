import React, { createContext, useContext, useState, useEffect } from "react";
import useTickets from "../../hooks/useTickets";

const AvailableTicketsContext = createContext();

export const AvailableTicketsProvider = ({ children }) => {
  const [availableTickets, setAvailableTickets] = useState([]);

  const updateAvailableTickets = (tickets) => {
    setAvailableTickets(tickets || []);
  };

  const getAllTicketIds = () => {
    return availableTickets.map(ticket => ticket.id);
  };

  return (
    <AvailableTicketsContext.Provider
      value={{
        availableTickets,
        updateAvailableTickets,
        getAllTicketIds,
      }}
    >
      {children}
    </AvailableTicketsContext.Provider>
  );
};

export const useAvailableTickets = () => {
  const context = useContext(AvailableTicketsContext);
  if (!context) {
    throw new Error("useAvailableTickets must be used within a AvailableTicketsProvider");
  }
  return context;
};
