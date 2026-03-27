import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Pagination from "@material-ui/lab/Pagination";
import * as XLSX from "xlsx";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

import {
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Switch,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { UsersFilter } from "../../components/UsersFilter";
import { TagsFilter } from "../../components/TagsFilter";
import { WhatsappsFilter } from "../../components/WhatsappsFilter";
import { StatusFilter } from "../../components/StatusFilter";
import useDashboard from "../../hooks/useDashboard";

import QueueSelectCustom from "../../components/QueueSelectCustom";
import moment from "moment";
import ShowTicketLogModal from "../../components/ShowTicketLogModal";

import { blue, green } from "@material-ui/core/colors";
import {
  Facebook,
  Forward,
  History,
  Instagram,
  Replay,
  SaveAlt,
  Visibility,
  WhatsApp,
} from "@material-ui/icons";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import { Field } from "formik";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    background: theme.palette.fancyBackground,
  },
  formControl: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  mainPaper: {
    flex: 1,
    marginTop: 40,
    borderRadius: 20,
    border: "0px !important",
    marginBottom: 40,
    overflow: "hidden",
  },
  mainPaperTable: {
    flex: 1,
    overflow: "auto",
    height: "68vh",
    ...theme.scrollbarStylesSoftBig,
  },
  mainPaperFilter: {
    flex: 1,
    width: "100%",
    height: "auto",
    overflow: "visible",
    padding: theme.spacing(1.5),
  },
  mainHeaderBlock: {
    [theme.breakpoints.down("md")]: {
      display: "flex",
      flexWrap: "wrap",
    },
  },
  filterItem: {
    width: 200,
    [theme.breakpoints.down("md")]: {
      width: "45%",
    },
  },
  filterCell: {
    width: "100%",
    minWidth: 0,
    "& > *": {
      width: "100%",
    },
    "& .MuiFormControl-root": {
      width: "100%",
      margin: 0,
    },
    "& .MuiAutocomplete-root": {
      width: "100%",
    },
    "& .MuiTextField-root": {
      width: "100%",
    },
    "& .MuiOutlinedInput-root": {
      minHeight: 40,
    },
  },
  actionsCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    width: "100%",
    minHeight: 40,
    "& .MuiFormControlLabel-root": {
      marginRight: 0,
    },
  },
}));

const Reports = () => {
  const classes = useStyles();
  const history = useHistory();
  const { getReport } = useDashboard();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Defina o tamanho da página

  const [searchParam, setSearchParam] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);

  const [tagIds, setTagIds] = useState([]);
  const [queueIds, setQueueIds] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [options, setOptions] = useState([]);
  const [dateFrom, setDateFrom] = useState(
    moment("1", "D").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [onlyRated, setOnlyRated] = useState(false);
  const [totalTickets, setTotalTickets] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [cpf, setCpf] = useState("");

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const [metaBlockedMessages, setMetaBlockedMessages] = useState([]);
  const [metaBlockedTotal, setMetaBlockedTotal] = useState(0);
  const [metaBlockedPageNumber, setMetaBlockedPageNumber] = useState(1);
  const [metaBlockedPageSize, setMetaBlockedPageSize] = useState(10);
  const [metaBlockedLoading, setMetaBlockedLoading] = useState(false);
  const [selectedMetaMessageIds, setSelectedMetaMessageIds] = useState([]);
  const [resendingMeta, setResendingMeta] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState(0);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam },
          });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setTagIds(tags);
  };

  const buildReportFilters = () => ({
    searchParam,
    contactId: selectedContactId,
    whatsappId: JSON.stringify(selectedWhatsapp),
    tags: JSON.stringify(tagIds),
    users: JSON.stringify(userIds),
    queueIds: JSON.stringify(queueIds),
    status: JSON.stringify(selectedStatus),
    dateFrom,
    dateTo,
    empresa: empresa || "",
    cpf: cpf || ""
  });

  const handleFilterMetaBlocked = async (
    page = metaBlockedPageNumber,
    customPageSize = metaBlockedPageSize
  ) => {
    setMetaBlockedLoading(true);

    try {
      const filters = buildReportFilters();
      const { data } = await api.get("/messages/meta-blocked", {
        params: {
          ...filters,
          page,
          pageSize: customPageSize
        }
      });

      setMetaBlockedMessages(data?.messages || []);
      setMetaBlockedTotal(data?.totalMessages || 0);
      setMetaBlockedPageNumber(page);
      setSelectedMetaMessageIds([]);
    } catch (error) {
      toastError(error);
    } finally {
      setMetaBlockedLoading(false);
    }
  };

  const handleToggleMetaMessageSelection = (messageId, canSelect) => {
    if (!canSelect) return;

    setSelectedMetaMessageIds((prevState) => {
      if (prevState.includes(messageId)) {
        return prevState.filter((id) => id !== messageId);
      }

      return [...prevState, messageId];
    });
  };

  const handleToggleSelectAllEligibleMetaMessages = (checked) => {
    if (!checked) {
      setSelectedMetaMessageIds([]);
      return;
    }

    const eligibleIds = metaBlockedMessages
      .filter((message) => message.resendEligible)
      .map((message) => message.id);

    setSelectedMetaMessageIds(eligibleIds);
  };

  const handleResendMetaMessages = async (messageIds) => {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      toast.info("Selecione ao menos uma mensagem elegível para reenviar.");
      return;
    }

    setResendingMeta(true);

    try {
      const { data } = await api.post("/messages/meta-blocked/resend", {
        messageIds
      });

      const successCount = data?.successCount || 0;
      const failedCount = data?.failedCount || 0;

      if (successCount > 0) {
        toast.success(`${successCount} mensagem(ns) reenviada(s) com sucesso.`);
      }

      if (failedCount > 0) {
        toast.warn(`${failedCount} mensagem(ns) não puderam ser reenviadas.`);
      }

      await handleFilterMetaBlocked(metaBlockedPageNumber);
    } catch (error) {
      toastError(error);
    } finally {
      setResendingMeta(false);
    }
  };

  const exportarGridParaExcel = async () => {
    setLoading(true); // Define o estado de loading como true durante o carregamento

    try {
      const filters = buildReportFilters();
      const data = await getReport({
        ...filters,
        page: 1,
        pageSize: 9999999,
        onlyRated: onlyRated ? "true" : "false"
      });

      const ticketsData = data.tickets.map((ticket) => {
        const formatDate = (dateString) => {
          if (!dateString || dateString === null) {
            return { date: "", time: "" };
          }

          if (dateString.includes("/") && dateString.includes(" ")) {
            const [datePart, timePart] = dateString.split(" ");
            return {
              date: datePart,
              time: timePart,
            };
          }

          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
            return { date: "", time: "" };
          }

          return {
            date: date.toLocaleDateString("pt-BR"),
            time: date.toLocaleTimeString("pt-BR"),
          };
        };

        const formatSupportTime = (timeString) => {
          if (!timeString) return "";

          if (timeString === "0") return "0min";

          const match = timeString.match(
            /(\d+)\s*d,?\s*(\d+)\s*hr?s?\s*e?\s*(\d+)\s*m/
          );
          if (!match) return timeString;

          const days = parseInt(match[1]);
          const hours = parseInt(match[2]);
          const minutes = parseInt(match[3]);

          let result = "";
          if (days > 0) result += `${days}d`;
          if (hours > 0) result += `${hours}h`;
          if (minutes > 0) result += `${minutes}min`;

          return result || "0min";
        };

        const createdAtFormatted = formatDate(ticket.createdAt);
        const closedAtFormatted = formatDate(ticket.closedAt);

        return {
          id: ticket.id,
          Conexão: ticket.whatsappName,
          Contato: ticket.contactName,
          Empresa: ticket.empresa || "-",
          Usuário: ticket.userName,
          Fila: ticket.queueName,
          Status: ticket.status,
          ÚltimaMensagem: ticket.lastMessage,
          DataAbertura: createdAtFormatted.date,
          HoraAbertura: createdAtFormatted.time,
          DataFechamento: closedAtFormatted.date,
          HoraFechamento: closedAtFormatted.time,
          TempoDeAtendimento: formatSupportTime(ticket.supportTime),
          nps: ticket.NPS || "",
          ValorDaVenda:
            ticket.valorVenda !== undefined && ticket.valorVenda !== null
              ? ticket.valorVenda
              : "-",
          MotivoDaNaoVenda: ticket.motivoNaoVenda || "-",
          FinalizadoComVenda:
            ticket.finalizadoComVenda === true
              ? "Sim"
              : ticket.finalizadoComVenda === false
              ? "Não"
              : "-",
        };
      });

      console.log(ticketsData);

      // RDS.CHAT - preparando os dados aqui...
      const getTranslation = (key, fallback) => {
        const translation = i18n.t(key);
        return translation !== key ? translation : fallback;
      };

      const formatDateBR = (dateStr) => {
        if (!dateStr)
          return getTranslation(
            "reports.exportExcel.notInformed",
            "Não informado"
          );
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
      };

      const translations = {
        title: getTranslation(
          "reports.exportExcel.title",
          "Relatórios de Atendimentos"
        ),
        startDate: getTranslation(
          "reports.exportExcel.startDate",
          "Data inicial"
        ),
        endDate: getTranslation("reports.exportExcel.endDate", "Data final"),
        columns: {
          id: getTranslation("reports.exportExcel.columns.id", "ID"),
          connection: getTranslation(
            "reports.exportExcel.columns.connection",
            "Conexão"
          ),
          contact: getTranslation(
            "reports.exportExcel.columns.contact",
            "Contato"
          ),
          company: getTranslation(
            "reports.exportExcel.columns.company",
            "Empresa"
          ),
          user: getTranslation("reports.exportExcel.columns.user", "Usuário"),
          queue: getTranslation("reports.exportExcel.columns.queue", "Fila"),
          status: getTranslation(
            "reports.exportExcel.columns.status",
            "Status"
          ),
          lastMessage: getTranslation(
            "reports.exportExcel.columns.lastMessage",
            "Última Mensagem"
          ),
          openDate: getTranslation(
            "reports.exportExcel.columns.openDate",
            "Data Abertura"
          ),
          openTime: getTranslation(
            "reports.exportExcel.columns.openTime",
            "Hora Abertura"
          ),
          closeDate: getTranslation(
            "reports.exportExcel.columns.closeDate",
            "Data Fechamento"
          ),
          closeTime: getTranslation(
            "reports.exportExcel.columns.closeTime",
            "Hora Fechamento"
          ),
          supportTime: getTranslation(
            "reports.exportExcel.columns.supportTime",
            "Tempo de Atendimento"
          ),
          nps: getTranslation("reports.exportExcel.columns.nps", "NPS"),
          valorVenda: getTranslation(
            "reports.exportExcel.columns.valorVenda",
            "Valor da Venda"
          ),
          motivoNaoVenda: getTranslation(
            "reports.exportExcel.columns.motivoNaoVenda",
            "Motivo da Não Venda"
          ),
          finalizadoComVenda: getTranslation(
            "reports.exportExcel.columns.finalizadoComVenda",
            "Finalizado com Venda"
          ),
        },
      };

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [translations.title],
        [`${translations.startDate}: ${formatDateBR(dateFrom)}`],
        [`${translations.endDate}: ${formatDateBR(dateTo)}`],
        [],
        [
          translations.columns.id,
          translations.columns.connection,
          translations.columns.contact,
          translations.columns.company,
          translations.columns.user,
          translations.columns.queue,
          translations.columns.status,
          translations.columns.lastMessage,
          translations.columns.openDate,
          translations.columns.openTime,
          translations.columns.closeDate,
          translations.columns.closeTime,
          translations.columns.supportTime,
          translations.columns.nps,
          translations.columns.valorVenda,
          translations.columns.motivoNaoVenda,
          translations.columns.finalizadoComVenda,
        ],
      ]);

      XLSX.utils.sheet_add_json(ws, ticketsData, {
        origin: "A6",
        skipHeader: true,
      });

      if (!ws["!merges"]) ws["!merges"] = [];
      ws["!merges"].push({ s: { c: 0, r: 0 }, e: { c: 16, r: 0 } });

      if (!ws["!cols"]) ws["!cols"] = [];
      ws["!cols"] = [
        { wch: 8 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 30 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      if (!ws["!rows"]) ws["!rows"] = [];
      ws["!rows"] = [
        { hpt: 25 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 10 },
        { hpt: 25 },
      ];

      const range = XLSX.utils.decode_range(ws["!ref"]);

      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
          if (!ws[cellAddress]) continue;

          if (!ws[cellAddress].s) ws[cellAddress].s = {};

          if (rowNum === 0) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "4472C4" } },
              alignment: { horizontal: "center", vertical: "center" },
            };
          } else if (rowNum === 1 || rowNum === 2) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 12 },
              fill: { fgColor: { rgb: "E7E6E6" } },
            };
          } else if (rowNum === 4) {
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "70AD47" } },
              alignment: { horizontal: "center", vertical: "center" },
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, "RelatorioDeAtendimentos");
      XLSX.writeFile(wb, "relatorio-de-atendimentos.xlsx", {
        cellStyles: true,
        bookType: "xlsx",
      });

      setPageNumber(pageNumber);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async (pageNumber) => {
    setLoading(true);
    console.log(onlyRated);
    try {
      const filters = buildReportFilters();
      const data = await getReport({
        ...filters,
        page: pageNumber,
        pageSize: pageSize,
        onlyRated: onlyRated ? "true" : "false"
      });

      setTotalTickets(data.totalTickets.total);

      // Verifica se há mais resultados para definir hasMore
      setHasMore(data.tickets.length === pageSize);

      setTickets(data.tickets); // Se for a primeira página, substitua os tickets

      setPageNumber(pageNumber); // Atualiza o estado da página atual
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false); // Define o estado de loading como false após o carregamento
    }
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setUserIds(users);
  };

  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);
    setSelectedWhatsapp(whatsapp);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);

    setSelectedStatus(statusFilter);
  };
  const IconChannel = (channel) => {
    switch (channel) {
      case "facebook":
        return (
          <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />
        );
      case "instagram":
        return (
          <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />
        );
      case "whatsapp":
        return (
          <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
        );
      default:
        return "error";
    }
  };

  const renderOption = (option) => {
    if (option.number) {
      return (
        <>
          {IconChannel(option.channel)}
          <Typography
            component="span"
            style={{
              fontSize: 14,
              marginLeft: "10px",
              display: "inline-flex",
              alignItems: "center",
              lineHeight: "2",
            }}
          >
            {option.name} - {option.number}
          </Typography>
        </>
      );
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const handleSelectOption = (e, newValue) => {
    setSelectedContactId(newValue.id);
    setSearchParam("");
  };

  const renderOptionLabel = (option) => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };
  const filter = createFilterOptions({
    trim: true,
  });

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);
    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }
    return filtered;
  };
  const renderContactAutocomplete = () => {
    return (
      <Autocomplete
        fullWidth
        options={options}
        loading={loading}
        clearOnBlur
        autoHighlight
        freeSolo
        size="small"
        clearOnEscape
        getOptionLabel={renderOptionLabel}
        renderOption={renderOption}
        filterOptions={createAddContactOption}
        onChange={(e, newValue) => handleSelectOption(e, newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={i18n.t("newTicketModal.fieldLabel")}
            variant="outlined"
            autoFocus
            size="small"
            onChange={(e) => setSearchParam(e.target.value)}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <React.Fragment>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
      />
    );
  };

  const eligibleMetaMessagesOnPage = metaBlockedMessages.filter(
    (message) => message.resendEligible
  );

  const allEligibleMetaSelected =
    eligibleMetaMessagesOnPage.length > 0 &&
    eligibleMetaMessagesOnPage.every((message) =>
      selectedMetaMessageIds.includes(message.id)
    );

  const handleChangeReportTab = (event, value) => {
    setActiveReportTab(value);

    if (value === 1 && metaBlockedMessages.length === 0) {
      handleFilterMetaBlocked(1);
    }

    if (value === 0 && tickets.length === 0) {
      handleFilter(1);
    }
  };

  useEffect(() => {
    handleFilter(1);
    handleFilterMetaBlocked(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MainContainer className={classes.mainContainer}>
      {openTicketMessageDialog && (
        <ShowTicketLogModal
          isOpen={openTicketMessageDialog}
          handleClose={() => setOpenTicketMessageDialog(false)}
          ticketId={ticketOpen.id}
        />
      )}
      <Title>{i18n.t("reports.title")}</Title>

      <MainHeader
        className={classes.mainHeaderFilter}
        style={{ display: "flex" }}
      >
        <Paper className={classes.mainPaperFilter}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              {renderContactAutocomplete()}
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <WhatsappsFilter
                onFiltered={handleSelectedWhatsapps}
                disablePadding
              />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <StatusFilter onFiltered={handleSelectedStatus} disablePadding />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <UsersFilter onFiltered={handleSelectedUsers} disablePadding />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <TagsFilter onFiltered={handleSelectedTags} disablePadding />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <QueueSelectCustom
                selectedQueueIds={queueIds}
                onChange={(values) => setQueueIds(values)}
                disableTopMargin
              />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <TextField
                label="Empresa"
                value={empresa}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Filtrar por empresa"
              />
            </Grid>
            <Grid item xs={12} md={3} xl={3} className={classes.filterCell}>
              <TextField
                label="CPF"
                value={cpf}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Filtrar por CPF"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3} className={classes.filterCell}>
              <TextField
                label={i18n.t("reports.startDate")}
                type="date"
                value={dateFrom}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} className={classes.filterCell}>
              <TextField
                label={i18n.t("reports.endDate")}
                type="date"
                value={dateTo}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid
              item
              xs={12}
              sm={12}
              md={6}
              className={classes.actionsCell}
            >
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={onlyRated}
                    onChange={() => setOnlyRated(!onlyRated)}
                  />
                }
                label={i18n.t("reports.buttons.onlyRated")}
              />
              <IconButton onClick={exportarGridParaExcel} aria-label="Exportar para Excel">
                <SaveAlt />
              </IconButton>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  handleFilter(1);
                  handleFilterMetaBlocked(1);
                }}
                size="small"
              >
                {i18n.t("reports.buttons.filter")}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </MainHeader>

      <Paper variant="outlined" style={{ marginBottom: 12 }}>
        <Tabs
          value={activeReportTab}
          onChange={handleChangeReportTab}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Relatório de Atendimentos" />
          <Tab label="Bloqueios Meta" />
        </Tabs>
      </Paper>

      {activeReportTab === 0 && (
      <>
      <Paper className={classes.mainPaperTable} variant="outlined">
        <Table size="small" id="grid-attendants">
          <TableHead>
            <TableRow>
              {/* <TableCell padding="checkbox" /> */}
              <TableCell align="center">{i18n.t("reports.table.id")}</TableCell>
              <TableCell align="left">
                {i18n.t("reports.table.whatsapp")}
              </TableCell>
              <TableCell align="left">
                {i18n.t("reports.table.contact")}
              </TableCell>
              <TableCell align="left">Empresa</TableCell>
              <TableCell align="left">{i18n.t("reports.table.user")}</TableCell>
              <TableCell align="left">
                {i18n.t("reports.table.queue")}
              </TableCell>
              <TableCell align="left">{i18n.t("wallets.wallet")}</TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.status")}
              </TableCell>
              <TableCell align="left">
                {i18n.t("reports.table.lastMessage")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.dateOpen")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.dateClose")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.supportTime")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.NPS")}
              </TableCell>
              <TableCell align="center">Valor da Venda</TableCell>
              <TableCell align="center">Motivo da Não Venda</TableCell>
              <TableCell align="center">Finalizado com Venda</TableCell>
              <TableCell align="center">
                {i18n.t("reports.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell align="center">{ticket.id}</TableCell>
                  <TableCell align="left">{ticket?.whatsappName}</TableCell>
                  <TableCell align="left">{ticket?.contactName}</TableCell>
                  <TableCell align="left">{ticket?.empresa || "-"}</TableCell>
                  <TableCell align="left">{ticket?.userName}</TableCell>
                  <TableCell align="left">{ticket?.queueName}</TableCell>
                  <TableCell align="left">
                    {ticket?.walletName || "-"}
                  </TableCell>
                  <TableCell align="center">{ticket?.status}</TableCell>
                  <TableCell align="left">{ticket?.lastMessage}</TableCell>
                  <TableCell align="center">{ticket?.createdAt}</TableCell>
                  <TableCell align="center">{ticket?.closedAt}</TableCell>
                  <TableCell align="center">{ticket?.supportTime}</TableCell>
                  <TableCell align="center">{ticket?.NPS}</TableCell>
                  <TableCell align="center">
                    {ticket?.valorVenda !== undefined &&
                    ticket?.valorVenda !== null
                      ? ticket.valorVenda
                      : "-"}
                  </TableCell>
                  <TableCell align="center">
                    {ticket?.motivoNaoVenda || "-"}
                  </TableCell>
                  <TableCell align="center">
                    {ticket?.finalizadoComVenda === true
                      ? "Sim"
                      : ticket?.finalizadoComVenda === false
                      ? "Não"
                      : "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      noWrap
                      component="span"
                      variant="body2"
                      color="textPrimary"
                    >
                      <Tooltip title="Logs do Ticket">
                        <History
                          onClick={() => {
                            setOpenTicketMessageDialog(true);
                            setTicketOpen(ticket);
                          }}
                          fontSize="small"
                          style={{
                            color: blue[700],
                            cursor: "pointer",
                            marginLeft: 10,
                            verticalAlign: "middle",
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Acessar Ticket">
                        <Forward
                          onClick={() => {
                            history.push(`/tickets/${ticket.uuid}`);
                          }}
                          fontSize="small"
                          style={{
                            color: green[700],
                            cursor: "pointer",
                            marginLeft: 10,
                            verticalAlign: "middle",
                          }}
                        />
                      </Tooltip>
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton avatar columns={3} />}
            </>
          </TableBody>
        </Table>
      </Paper>

      <div>
        <Grid container>
          <Grid item xs={12} sm={10} md={10}>
            <Pagination
              count={Math.ceil(totalTickets / pageSize)} // Calcula o nmero total de páginas com base no nmero total de tickets e no tamanho da página
              page={pageNumber} // Define a página atual
              onChange={(event, value) => handleFilter(value)} // Função de callback para mudanças de página
            />
          </Grid>
          <Grid item xs={12} sm={2} md={2}>
            <FormControl margin="dense" variant="outlined" fullWidth>
              <InputLabel>{i18n.t("tickets.search.ticketsPerPage")}</InputLabel>
              <Select
                labelId="dialog-select-prompt-label"
                id="dialog-select-prompt"
                name="pageSize"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value);
                }}
                label={i18n.t("tickets.search.ticketsPerPage")}
                fullWidth
                MenuProps={{
                  anchorOrigin: {
                    vertical: "center",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "center",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
              >
                <MenuItem value={5}>{"5"}</MenuItem>
                <MenuItem value={10}>{"10"}</MenuItem>
                <MenuItem value={20}>{"20"}</MenuItem>
                <MenuItem value={50}>{"50"}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>
      </>
      )}

      {activeReportTab === 1 && (
      <>
      <Paper
        variant="outlined"
        style={{ marginTop: 20, padding: 12, borderRadius: 12 }}
      >
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} md={5}>
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              Mensagens bloqueadas Meta
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total encontrado: {metaBlockedTotal}
            </Typography>
          </Grid>
          <Grid item xs={12} md={7} style={{ textAlign: "right" }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => handleFilterMetaBlocked(1)}
              disabled={metaBlockedLoading || resendingMeta}
              style={{ marginRight: 8 }}
            >
              Atualizar bloqueios
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => handleResendMetaMessages(selectedMetaMessageIds)}
              disabled={
                selectedMetaMessageIds.length === 0 ||
                metaBlockedLoading ||
                resendingMeta
              }
            >
              Reenviar selecionadas
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        className={classes.mainPaperTable}
        variant="outlined"
        style={{ marginTop: 12, height: "48vh" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  checked={allEligibleMetaSelected}
                  indeterminate={
                    selectedMetaMessageIds.length > 0 && !allEligibleMetaSelected
                  }
                  onChange={(e) =>
                    handleToggleSelectAllEligibleMetaMessages(e.target.checked)
                  }
                />
              </TableCell>
              <TableCell align="center">ID Msg</TableCell>
              <TableCell align="center">Ticket</TableCell>
              <TableCell align="left">Conexão</TableCell>
              <TableCell align="left">Contato</TableCell>
              <TableCell align="left">Usuário</TableCell>
              <TableCell align="left">Fila</TableCell>
              <TableCell align="left">Mensagem</TableCell>
              <TableCell align="left">Erro Meta</TableCell>
              <TableCell align="center">Código</TableCell>
              <TableCell align="center">Data Erro</TableCell>
              <TableCell align="center">Elegível</TableCell>
              <TableCell align="left">Motivo Bloqueio</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metaBlockedMessages.map((message) => (
              <TableRow key={message.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    checked={selectedMetaMessageIds.includes(message.id)}
                    disabled={!message.resendEligible || resendingMeta}
                    onChange={() =>
                      handleToggleMetaMessageSelection(
                        message.id,
                        message.resendEligible
                      )
                    }
                  />
                </TableCell>
                <TableCell align="center">{message.id}</TableCell>
                <TableCell align="center">{message.ticketId}</TableCell>
                <TableCell align="left">{message.whatsappName || "-"}</TableCell>
                <TableCell align="left">{message.contactName || "-"}</TableCell>
                <TableCell align="left">{message.userName || "-"}</TableCell>
                <TableCell align="left">{message.queueName || "-"}</TableCell>
                <TableCell align="left">{message.body || "-"}</TableCell>
                <TableCell align="left">{message.deliveryError || "-"}</TableCell>
                <TableCell align="center">
                  {message.deliveryErrorCode || "-"}
                </TableCell>
                <TableCell align="center">
                  {moment(message.deliveryErrorAt || message.createdAt).format(
                    "DD/MM/YYYY HH:mm"
                  )}
                </TableCell>
                <TableCell align="center">
                  {message.resendEligible ? "Sim" : "Não"}
                </TableCell>
                <TableCell align="left">
                  {message.resendBlockedReason || "-"}
                </TableCell>
                <TableCell align="center">
                  <Tooltip
                    title={
                      message.resendEligible
                        ? "Reenviar mensagem"
                        : message.resendBlockedReason || "Mensagem não elegível"
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        disabled={!message.resendEligible || resendingMeta}
                        onClick={() => handleResendMetaMessages([message.id])}
                      >
                        <Replay fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Acessar Ticket">
                    <IconButton
                      size="small"
                      onClick={() => history.push(`/tickets/${message.ticketUuid}`)}
                    >
                      <Forward fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {metaBlockedLoading && <TableRowSkeleton avatar columns={3} />}

            {!metaBlockedLoading && metaBlockedMessages.length === 0 && (
              <TableRow>
                <TableCell align="center" colSpan={14}>
                  Nenhuma mensagem bloqueada pela Meta encontrada com os filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <div style={{ marginTop: 8 }}>
        <Grid container>
          <Grid item xs={12} sm={10} md={10}>
            <Pagination
              count={Math.max(1, Math.ceil(metaBlockedTotal / metaBlockedPageSize))}
              page={metaBlockedPageNumber}
              onChange={(event, value) => handleFilterMetaBlocked(value)}
            />
          </Grid>
          <Grid item xs={12} sm={2} md={2}>
            <FormControl margin="dense" variant="outlined" fullWidth>
              <InputLabel>{i18n.t("tickets.search.ticketsPerPage")}</InputLabel>
              <Select
                value={metaBlockedPageSize}
                onChange={(e) => {
                  const selectedPageSize = Number(e.target.value);
                  setMetaBlockedPageSize(selectedPageSize);
                  setMetaBlockedPageNumber(1);
                  handleFilterMetaBlocked(1, selectedPageSize);
                }}
                label={i18n.t("tickets.search.ticketsPerPage")}
                fullWidth
                MenuProps={{
                  anchorOrigin: {
                    vertical: "center",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "center",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
              >
                <MenuItem value={5}>{"5"}</MenuItem>
                <MenuItem value={10}>{"10"}</MenuItem>
                <MenuItem value={20}>{"20"}</MenuItem>
                <MenuItem value={50}>{"50"}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>
      </>
      )}
    </MainContainer>
  );
};

export default Reports;
