import React, { createContext, useContext, useReducer } from "react";

const SelectedTicketsContext = createContext();

const initialState = {
  selectedTickets: new Set(),
  isSelectionMode: false,
};

const selectedTicketsReducer = (state, action) => {
  switch (action.type) {
    case "TOGGLE_SELECTION_MODE":
      return {
        ...state,
        isSelectionMode: !state.isSelectionMode,
        selectedTickets: !state.isSelectionMode ? state.selectedTickets : new Set(),
      };

    case "TOGGLE_TICKET_SELECTION":
      const newSelectedTickets = new Set(state.selectedTickets);
      if (newSelectedTickets.has(action.ticketId)) {
        newSelectedTickets.delete(action.ticketId);
      } else {
        newSelectedTickets.add(action.ticketId);
      }
      return {
        ...state,
        selectedTickets: newSelectedTickets,
      };

    case "SELECT_ALL_TICKETS":
      return {
        ...state,
        selectedTickets: new Set(action.ticketIds),
      };

    case "CLEAR_SELECTION":
      return {
        ...state,
        selectedTickets: new Set(),
      };

    case "REMOVE_TICKETS_FROM_SELECTION":
      const updatedSelection = new Set(state.selectedTickets);
      action.ticketIds.forEach(id => updatedSelection.delete(id));
      return {
        ...state,
        selectedTickets: updatedSelection,
      };

    default:
      return state;
  }
};

export const SelectedTicketsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(selectedTicketsReducer, initialState);

  const toggleSelectionMode = () => {
    dispatch({ type: "TOGGLE_SELECTION_MODE" });
  };

  const toggleTicketSelection = (ticketId) => {
    dispatch({ type: "TOGGLE_TICKET_SELECTION", ticketId });
  };

  const selectAllTickets = (ticketIds) => {
    dispatch({ type: "SELECT_ALL_TICKETS", ticketIds });
  };

  const clearSelection = () => {
    dispatch({ type: "CLEAR_SELECTION" });
  };

  const removeTicketsFromSelection = (ticketIds) => {
    dispatch({ type: "REMOVE_TICKETS_FROM_SELECTION", ticketIds });
  };

  const isTicketSelected = (ticketId) => {
    return state.selectedTickets.has(ticketId);
  };

  const getSelectedTicketsArray = () => {
    return Array.from(state.selectedTickets);
  };

  return (
    <SelectedTicketsContext.Provider
      value={{
        selectedTickets: state.selectedTickets,
        isSelectionMode: state.isSelectionMode,
        selectedCount: state.selectedTickets.size,
        toggleSelectionMode,
        toggleTicketSelection,
        selectAllTickets,
        clearSelection,
        removeTicketsFromSelection,
        isTicketSelected,
        getSelectedTicketsArray,
      }}
    >
      {children}
    </SelectedTicketsContext.Provider>
  );
};

export const useSelectedTickets = () => {
  const context = useContext(SelectedTicketsContext);
  if (!context) {
    throw new Error("useSelectedTickets must be used within a SelectedTicketsProvider");
  }
  return context;
};
