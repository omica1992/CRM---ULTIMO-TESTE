import React, { useState, useEffect, useReducer, useContext, useMemo, useCallback } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useAvailableTickets } from "../../context/AvailableTickets/AvailableTicketsContext";

const useStyles = makeStyles((theme) => ({
    ticketsListWrapper: {
        position: "relative",
        display: "flex",
        height: "100%",
        flexDirection: "column",
        overflow: "hidden",
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },

    ticketsList: {
        flex: 1,
        maxHeight: "100%",
        overflowY: "scroll",
        ...theme.scrollbarStyles,
        borderTop: "2px solid rgba(0, 0, 0, 0.12)",
    },

    ticketsListHeader: {
        color: "rgb(67, 83, 105)",
        zIndex: 2,
        backgroundColor: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },

    ticketsCount: {
        fontWeight: "normal",
        color: "rgb(104, 121, 146)",
        marginLeft: "8px",
        fontSize: "14px",
    },

    noTicketsText: {
        textAlign: "center",
        color: "rgb(104, 121, 146)",
        fontSize: "14px",
        lineHeight: "1.4",
    },

    noTicketsTitle: {
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "600",
        margin: "0px",
    },

    noTicketsDiv: {
        display: "flex",
        // height: "190px",
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
}));

const getTicketSortTime = (ticket) => {
    const raw = ticket?.lastMessageAt || ticket?.updatedAt || ticket?.createdAt;
    if (!raw) return 0;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
};

const ticketSortAsc = (a, b) => getTicketSortTime(a) - getTicketSortTime(b);

const ticketSortDesc = (a, b) => getTicketSortTime(b) - getTicketSortTime(a);

const reducer = (state, action) => {
    //console.log("action", action, state)
    const sortDir = action.sortDir;
    
    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;

        newTickets.forEach((ticket) => {
            const ticketIndex = state.findIndex((t) => t.id === ticket.id);
            if (ticketIndex !== -1) {
                state[ticketIndex] = {
                    ...state[ticketIndex],
                    ...ticket,
                    lastMessageAt: ticket.lastMessageAt || state[ticketIndex].lastMessageAt,
                    lastMessagePreview: ticket.lastMessagePreview || state[ticketIndex].lastMessagePreview
                };
                if (ticket.unreadMessages > 0) {
                    state.unshift(state.splice(ticketIndex, 1)[0]);
                }
            } else {
                state.push(ticket);
            }
        });
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET_UNREAD") {
        const ticketId = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state[ticketIndex].unreadMessages = 0;
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = {
                ...state[ticketIndex],
                ...ticket,
                lastMessageAt: ticket.lastMessageAt || state[ticketIndex].lastMessageAt,
                lastMessagePreview: ticket.lastMessagePreview || state[ticketIndex].lastMessagePreview
            };
        } else {
            state.unshift(ticket);
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = {
                ...state[ticketIndex],
                ...ticket,
                lastMessageAt: ticket.lastMessageAt || state[ticketIndex].lastMessageAt,
                lastMessagePreview: ticket.lastMessagePreview || state[ticketIndex].lastMessagePreview
            };
            state.unshift(state.splice(ticketIndex, 1)[0]);
        } else {
            if (action.status === action.payload.status) {
                state.unshift(ticket);
            }
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_CONTACT") {
        const contact = action.payload;
        const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
        if (ticketIndex !== -1) {
            state[ticketIndex].contact = contact;
        }
        return [...state];
    }

    if (action.type === "DELETE_TICKET") {
        const ticketId = action.payload;
        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state.splice(ticketIndex, 1);
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const TicketsListCustom = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        selectedQueueIds,
        updateCount,
        style,
        whatsappIds,
        forceSearch,
        statusFilter,
        userFilter,
        sortTickets
    } = props;

    const classes = useStyles();
    const [pageNumber, setPageNumber] = useState(1);
    let [ticketsList, dispatch] = useReducer(reducer, []);
    const [totalCount, setTotalCount] = useState(0); // ✅ Estado separado para contador total
    // Estado removido - usando contador do backend
    //   const socketManager = useContext(SocketContext);
    const { user, socket } = useContext(AuthContext);
    const { updateAvailableTickets } = useAvailableTickets();

    const { profile, queues } = user;
    const showTicketWithoutQueue = user.allTicket === 'enable';
    const companyId = user.companyId;

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [status, searchParam, dispatch, showAll, tags, users, forceSearch, selectedQueueIds, whatsappIds, statusFilter, sortTickets, searchOnMessages]);

    // Hook para carregar tickets e contador
    const { tickets, hasMore, loading, count, refetch } = useTickets({
        pageNumber,
        searchParam,
        status,
        showAll,
        searchOnMessages: searchOnMessages ? "true" : "false",
        tags: JSON.stringify(tags),
        users: JSON.stringify(users),
        queueIds: JSON.stringify(selectedQueueIds),
        whatsappIds: JSON.stringify(whatsappIds),
        statusFilter: JSON.stringify(statusFilter),
        userFilter,
        sortTickets
    });
    
    // Função para atualizar contador diretamente do backend
    const refreshCountFromBackend = useCallback(async () => {
        try {
            // Apenas atualiza o contador sem alterar a página
            await refetch();
        } catch (err) {
            console.error(`[${status}] Erro ao atualizar contador:`, err);
        }
    }, [refetch, status]);


    // Código de limpeza removido - usando contador do backend

    useEffect(() => {
        if (companyId) {
            dispatch({
                type: "LOAD_TICKETS",
                payload: tickets,
                status,
                sortDir: sortTickets
            });
        }
    }, [tickets]);

    // ✅ Atualizar totalCount quando count do backend mudar
    useEffect(() => {
        if (count !== undefined && count !== null) {
            setTotalCount(count);
            console.log(`[${status}] Contador inicial do backend: ${count}`);
        }
    }, [count]);
    
    // Evento global para atualizar contadores quando um ticket muda de status
    useEffect(() => {
        if (socket) {
            const handleTicketStatusChange = () => {
                console.log(`[${status}] Evento global de mudança de status - Atualizando contador`);
                refreshCountFromBackend();
            };
            
            socket.on('ticketStatus', handleTicketStatusChange);
            
            return () => {
                socket.off('ticketStatus', handleTicketStatusChange);
            };
        }
    }, [socket, status, refreshCountFromBackend]);

    useEffect(() => {
        const shouldUpdateTicket = ticket => {
            return (!ticket?.userId || ticket?.userId === user?.id || showAll) &&
                ((!ticket?.queueId && showTicketWithoutQueue) || selectedQueueIds.indexOf(ticket?.queueId) > -1)
            // (!blockNonDefaultConnections || (ticket.status == 'group' && ignoreUserConnectionForGroups) || !user?.whatsappId || ticket.whatsappId == user?.whatsappId);
        }
        // const shouldUpdateTicketUser = (ticket) =>
        //     selectedQueueIds.indexOf(ticket?.queueId) > -1 && (ticket?.userId === user?.id || !ticket?.userId);

        const notBelongsToUserQueues = (ticket) =>
            ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

        const onCompanyTicketTicketsList = (data) => {
            // Processar eventos de leitura
            if (data.action === "updateUnread") {
                dispatch({
                    type: "RESET_UNREAD",
                    payload: data.ticketId,
                    status: status,
                    sortDir: sortTickets
                });
                return;
            }

            // SOLUÇÃO SIMPLIFICADA: Atualizar contador diretamente do backend
            // quando houver mudança de status
            
            // PARTE 1: Processar DELETE - Apenas remove da lista visual
            if (data.action === "delete") {
                // Remover da lista visual
                dispatch({
                    type: "DELETE_TICKET", 
                    payload: data?.ticketId, 
                    status: status,
                    sortDir: sortTickets
                });
                
                // Atualizar contador do backend
                refreshCountFromBackend();
                return;
            }

            // PARTE 2: Processar UPDATE
            if (data.action === "update") {
                // Verificar se ticket existe na lista atual
                const ticketExists = ticketsList.find(t => t.id === data.ticket.id);
                
                // CASO 1: Ticket PERTENCE a esta aba (status correto + permissões)
                if (data.ticket.status === status && shouldUpdateTicket(data.ticket)) {
                    // Adicionar/atualizar na lista visual
                    dispatch({
                        type: "UPDATE_TICKET",
                        payload: data.ticket,
                        status: status,
                        sortDir: sortTickets
                    });
                    
                    // Atualizar contador do backend
                    refreshCountFromBackend();
                }
                // CASO 2: Ticket NÃO PERTENCE a esta aba (status diferente) mas ESTAVA na lista
                else if (ticketExists && data.ticket.status !== status) {
                    // Remover da lista visual
                    dispatch({
                        type: "DELETE_TICKET", 
                        payload: data.ticket.id, 
                        status: status,
                        sortDir: sortTickets
                    });
                    
                    // Atualizar contador do backend
                    refreshCountFromBackend();
                }
                // CASO 3: Ticket não pertence e não estava - ignorar
                else {
                    // Nada a fazer
                }
            }
        };

        const onCompanyAppMessageTicketsList = (data) => {
            // Processar apenas mensagens novas que pertencem a esta aba
            if (data.action === "create" &&
                shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
                
                // ✅ CORREÇÃO: Não incrementar contador manualmente
                // O contador deve sempre vir do backend para evitar inconsistências
                // Apenas atualizar a lista visual e mensagens não lidas
                
                console.log(`[${status}] Nova mensagem no ticket ${data.ticket.id} - Atualizando apenas lista visual`);
                
                // Atualizar na lista visual
                dispatch({
                    type: "UPDATE_TICKET_UNREAD_MESSAGES",
                    payload: data.ticket,
                    status: status,
                    sortDir: sortTickets
                });
            }
        };

        const onCompanyContactTicketsList = (data) => {
            if (data.action === "update" && data.contact) {
                dispatch({
                    type: "UPDATE_TICKET_CONTACT",
                    payload: data.contact,
                    status: status,
                    sortDir: sortTickets
                });
            }
        };

        const onConnectTicketsList = () => {
            if (status) {
                socket.emit("joinTickets", status);
            } else {
                socket.emit("joinNotification");
            }
        }

        socket.on("connect", onConnectTicketsList)
        socket.on(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
        socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
        socket.on(`company-${companyId}-contact`, onCompanyContactTicketsList);

        return () => {
            if (status) {
                socket.emit("leaveTickets", status);
            } else {
                socket.emit("leaveNotification");
            }
            socket.off("connect", onConnectTicketsList);
            socket.off(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
            socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
            socket.off(`company-${companyId}-contact`, onCompanyContactTicketsList);
        };

    }, [status, showAll, user, selectedQueueIds, tags, users, profile, queues, sortTickets, showTicketWithoutQueue]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            // ✅ CORREÇÃO FINAL: Usar totalCount que combina count do backend + atualizações via socket
            updateCount(totalCount);
        }
        // Atualizar tickets disponíveis para seleção múltipla
        updateAvailableTickets(ticketsList);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalCount, ticketsList]);

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    if (status && status !== "search") {
        ticketsList = ticketsList.filter(ticket => ticket.status === status)
    }

    return (
        <Paper className={classes.ticketsListWrapper} style={style}>
            <Paper
                square
                name="closed"
                elevation={0}
                className={classes.ticketsList}
                onScroll={handleScroll}
            >
                <List style={{ paddingTop: 0 }} >
                    {ticketsList.length === 0 && !loading ? (
                        <div className={classes.noTicketsDiv}>
                            <span className={classes.noTicketsTitle}>
                                {i18n.t("ticketsList.noTicketsTitle")}
                            </span>
                            <p className={classes.noTicketsText}>
                                {i18n.t("ticketsList.noTicketsMessage")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {ticketsList.map((ticket) => (
                                // <List key={ticket.id}>
                                //     {console.log(ticket)}
                                <TicketListItem
                                    ticket={ticket}
                                    key={ticket.id}
                                    setTabOpen={setTabOpen}
                                />
                                // </List>
                            ))}
                        </>
                    )}
                    {loading && <TicketsListSkeleton />}
                </List>
            </Paper>
        </Paper>
    );
};

export default TicketsListCustom;
