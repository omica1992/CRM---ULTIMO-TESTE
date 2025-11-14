import React, { useState } from "react";
import {
  Paper,
  Typography,
  IconButton,
  Button,
  Toolbar,
  makeStyles,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  TextField,
} from "@material-ui/core";
import {
  Close as CloseIcon,
  SwapHoriz as TransferIcon,
  SelectAll as SelectAllIcon,
  Clear as ClearIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import { useCallback } from "react";

import { useSelectedTickets } from "../../context/SelectedTickets/SelectedTicketsContext";
import { useAvailableTickets } from "../../context/AvailableTickets/AvailableTicketsContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import useQueues from "../../hooks/useQueues";
import { Autocomplete, createFilterOptions } from "@material-ui/lab";
import { CircularProgress } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    position: "fixed",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1300,
    minWidth: 400,
    maxWidth: "90vw",
    borderRadius: 24,
    boxShadow: theme.shadows[8],
  },
  toolbar: {
    minHeight: 56,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(1),
  },
  title: {
    flex: 1,
    fontWeight: 500,
  },
  actionButton: {
    marginLeft: theme.spacing(1),
  },
  bulkTransferDialog: {
    "& .MuiDialog-paper": {
      minWidth: 400,
    },
  },
}));

const BulkActionsBar = () => {
  const classes = useStyles();
  const {
    selectedCount,
    isSelectionMode,
    toggleSelectionMode,
    selectAllTickets,
    clearSelection,
    getSelectedTicketsArray,
    removeTicketsFromSelection,
  } = useSelectedTickets();

  const { getAllTicketIds } = useAvailableTickets();

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkTransferLoading, setBulkTransferLoading] = useState(false);
  const [transferToUser, setTransferToUser] = useState(null);
  const [transferToQueue, setTransferToQueue] = useState(null);
  const [includeMessage, setIncludeMessage] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  
  // Estados para usuários e filas
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { findAll: findAllQueues } = useQueues();

  // Funções de carregamento memoizadas
  const loadUsers = useCallback(async () => {
    if (users.length > 0 || usersLoading) return; // Já carregou ou está carregando
    
    setUsersLoading(true);
    try {
      const { data } = await api.get("/users/");
      setUsers(data.users || data || []);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      toast.error("Erro ao carregar usuários");
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [users.length, usersLoading]);

  const loadQueues = useCallback(async () => {
    if (queues.length > 0) return; // Já carregou
    
    try {
      const queuesList = await findAllQueues();
      setQueues(queuesList || []);
    } catch (err) {
      console.error("Erro ao carregar filas:", err);
      toast.error("Erro ao carregar filas");
      setQueues([]);
    }
  }, [queues.length, findAllQueues]);

  // Carregar usuários e filas quando o modal abrir
  React.useEffect(() => {
    if (bulkTransferOpen && !dataLoaded) {
      setDataLoaded(true);
      loadUsers();
      loadQueues();
    }
    
    if (!bulkTransferOpen) {
      setDataLoaded(false);
    }
  }, [bulkTransferOpen, dataLoaded, loadUsers, loadQueues]);

  if (!isSelectionMode) return null;

  const handleSelectAll = () => {
    const availableTicketIds = getAllTicketIds();
    selectAllTickets(availableTicketIds);
  };

  const handleCloseModal = () => {
    setBulkTransferOpen(false);
    setTransferToUser(null);
    setTransferToQueue(null);
    setIncludeMessage(false);
    setTransferMessage("");
    setDataLoaded(false); // Reset para permitir novo carregamento na próxima abertura
  };

  const handleBulkTransfer = async () => {
    if (!transferToUser && !transferToQueue) {
      toast.error("Selecione um usuário ou fila de destino");
      return;
    }

    setBulkTransferLoading(true);

    try {
      const selectedTicketIds = getSelectedTicketsArray();
      
      const transferData = {
        ticketIds: selectedTicketIds,
        ...(transferToUser && { userId: transferToUser.id }),
        ...(transferToQueue && { queueId: transferToQueue.id }),
        ...(includeMessage && transferMessage && { transferMessage }),
      };

      const response = await api.post("/tickets/bulk-transfer", transferData);

      const { successfulTransfers, failedTransfers, totalTickets } = response.data.data;

      if (successfulTransfers.length > 0) {
        toast.success(
          `${successfulTransfers.length} de ${totalTickets} tickets transferidos com sucesso!`
        );
        
        // Remover tickets transferidos da seleção
        removeTicketsFromSelection(successfulTransfers);
      }

      if (failedTransfers.length > 0) {
        console.log("Falhas na transferência:", failedTransfers);
        
        // Agrupar erros por tipo para uma mensagem mais clara
        const errorGroups = {};
        failedTransfers.forEach(f => {
          if (!errorGroups[f.error]) {
            errorGroups[f.error] = [];
          }
          errorGroups[f.error].push(f.ticketId);
        });

        let errorMessage = `${failedTransfers.length} tickets não puderam ser transferidos:\n\n`;
        Object.entries(errorGroups).forEach(([error, ticketIds]) => {
          errorMessage += `• ${error}: Tickets ${ticketIds.join(", ")}\n`;
        });

        toast.error(errorMessage, { 
          autoClose: 10000,
          style: { whiteSpace: "pre-line" }
        });
      }

      handleCloseModal();

    } catch (error) {
      console.error("Erro na transferência em massa:", error);
      toast.error("Erro ao realizar transferência em massa");
    } finally {
      setBulkTransferLoading(false);
    }
  };

  return (
    <>
      <Paper className={classes.root} elevation={8}>
        <Toolbar className={classes.toolbar}>
          <Typography variant="subtitle1" className={classes.title}>
            {selectedCount} {selectedCount === 1 ? "ticket selecionado" : "tickets selecionados"}
          </Typography>
          
          <Button
            variant="outlined"
            size="small"
            startIcon={<SelectAllIcon />}
            onClick={handleSelectAll}
            className={classes.actionButton}
          >
            Selecionar Todos
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={clearSelection}
            className={classes.actionButton}
          >
            Limpar
          </Button>

          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<TransferIcon />}
            onClick={() => setBulkTransferOpen(true)}
            disabled={selectedCount === 0}
            className={classes.actionButton}
          >
            Transferir
          </Button>

          <IconButton onClick={toggleSelectionMode}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </Paper>

      {/* Modal de Transferência em Massa */}
      <Dialog 
        open={bulkTransferOpen}
        onClose={handleCloseModal}
        className={classes.bulkTransferDialog}
      >
        <DialogTitle>
          Transferir {selectedCount} Tickets em Massa
        </DialogTitle>
        <DialogContent style={{ minWidth: 400, paddingTop: 20 }}>
          {/* Seleção de Usuário */}
          <Autocomplete
            options={users}
            loading={usersLoading && users.length === 0} // ✅ Forçar loading false se já temos usuários
            getOptionLabel={(option) => option.name}
            value={transferToUser}
            onChange={(event, newValue) => {
              setTransferToUser(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Transferir para Usuário"
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {(usersLoading && users.length === 0) ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            style={{ marginBottom: 16 }}
          />

          {/* Seleção de Fila */}
          <Autocomplete
            options={queues}
            getOptionLabel={(option) => option.name}
            value={transferToQueue}
            onChange={(event, newValue) => {
              setTransferToQueue(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Transferir para Fila"
                variant="outlined"
                fullWidth
              />
            )}
            style={{ marginBottom: 16 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={includeMessage}
                onChange={(e) => setIncludeMessage(e.target.checked)}
                color="primary"
              />
            }
            label="Incluir mensagem de transferência"
            style={{ marginTop: 16 }}
          />

          {includeMessage && (
            <TextField
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              placeholder="Digite a mensagem de transferência..."
              multiline
              rows={3}
              fullWidth
              variant="outlined"
              style={{ marginTop: 16 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>
            Cancelar
          </Button>
          <Button
            onClick={handleBulkTransfer}
            color="primary"
            variant="contained"
            disabled={bulkTransferLoading || (!transferToUser && !transferToQueue)}
          >
            {bulkTransferLoading ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BulkActionsBar;
