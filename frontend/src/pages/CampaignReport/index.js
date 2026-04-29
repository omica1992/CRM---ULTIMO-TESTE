import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { 
  Grid, 
  LinearProgress, 
  Typography, 
  Button, 
  Divider, 
  Card, 
  CardHeader, 
  CardContent, 
  Box, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Avatar,
  Tooltip,
  Checkbox
} from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import SendIcon from "@material-ui/icons/Send";
import MessageIcon from "@material-ui/icons/Message";
import ScheduleIcon from "@material-ui/icons/Schedule";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ListAltIcon from "@material-ui/icons/ListAlt";
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  ChartTooltip,
  Legend,
  Filler
);

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    marginBottom: theme.spacing(2),
  },
  textRight: {
    textAlign: "right",
  },
  tabPanelsContainer: {
    padding: theme.spacing(2),
  },
  summaryCards: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  summaryCard: {
    padding: theme.spacing(2),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    paddingBottom: 0,
  },
  cardIcon: {
    color: theme.palette.primary.main,
    fontSize: 40,
    marginBottom: theme.spacing(1),
  },
  progressContainer: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(3),
  },
  tableTitle: {
    margin: theme.spacing(2, 0),
    fontWeight: 500,
  },
  chartContainer: {
    height: 300,
    marginBottom: theme.spacing(4),
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  statusChip: {
    color: '#fff',
    fontWeight: 'bold',
  },
  deliveredChip: {
    backgroundColor: theme.palette.success.main,
  },
  pendingChip: {
    backgroundColor: theme.palette.warning.main,
  },
  failedChip: {
    backgroundColor: theme.palette.error.main,
  },
  pieChartContainer: {
    height: 250,
    position: 'relative',
    marginTop: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 500,
    margin: theme.spacing(2, 0),
  },
  detailsCard: {
    marginBottom: theme.spacing(2),
  },
  fullWidthGrid: {
    width: '100%',
  },
  avatar: {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
  },
}));

const CampaignReport = () => {
  const classes = useStyles();
  const history = useHistory();

  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState({});
  const [loading, setLoading] = useState(false);
  const [messageRows, setMessageRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedFailedShippingIds, setSelectedFailedShippingIds] = useState([]);
  const [resendingFailed, setResendingFailed] = useState(false);
  const mounted = useRef(true);
  const { user, socket } = useContext(AuthContext);

  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();

  const getShippingStatus = (item) => {
    if (item?.deliveredAt) return "delivered";
    if (item?.failedAt) return "failed";
    if (item?.sentAt) return "sent";
    return "pending";
  };

  const normalizeShippingItem = (item) => ({
    id: item.id,
    jobId: item.jobId,
    number: item.number,
    message: item.message
      ? item.message.substring(0, 50) + (item.message.length > 50 ? "..." : "")
      : "",
    fullMessage: item.message || "",
    sentAt: item.sentAt ? datetimeToClient(item.sentAt) : null,
    deliveredAt: item.deliveredAt ? datetimeToClient(item.deliveredAt) : null,
    failedAt: item.failedAt ? datetimeToClient(item.failedAt) : null,
    errorMessage: item.errorMessage || null,
    createdAt: item.createdAt ? datetimeToClient(item.createdAt) : null,
    metaMessageId: item.metaMessageId || null,
    status: getShippingStatus(item)
  });

  const statusCounts = React.useMemo(() => {
    const counts = {
      attempts: messageRows.length,
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      uniqueNumbers: new Set(messageRows.map((row) => row.number)).size
    };

    messageRows.forEach((row) => {
      counts[row.status] += 1;
    });

    return counts;
  }, [messageRows]);

  const chartData = React.useMemo(() => ({
    labels: ["Pendentes", "Enviadas à Meta", "Entregues", "Falhas"],
    datasets: [
      {
        data: [
          statusCounts.pending,
          statusCounts.sent,
          statusCounts.delivered,
          statusCounts.failed
        ],
        backgroundColor: [
          "rgba(255, 206, 86, 0.7)",
          "rgba(54, 162, 235, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(255, 99, 132, 0.7)"
        ],
        borderColor: [
          "rgba(255, 206, 86, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(255, 99, 132, 1)"
        ],
        borderWidth: 1
      }
    ]
  }), [statusCounts]);
  
  // Opções para o gráfico de pizza
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mounted.current) {
      findCampaign();
    }

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const companyId = user.companyId;
    // const socket = socketManager.GetSocket();

    const onCampaignEvent = (data) => {

      if (data.record.id === +campaignId) {
        setCampaign(data.record);

        if (data.record.status === "FINALIZADA") {
          setTimeout(() => {
            findCampaign();
          }, 5000);
        }
      }
    };
    socket.on(`company-${companyId}-campaign`, onCampaignEvent);

    return () => {
      socket.off(`company-${companyId}-campaign`, onCampaignEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    const companyId = user.companyId;

    const onCampaignShippingEvent = (data) => {
      const record = data?.record;

      if (!record || Number(record.campaignId) !== Number(campaignId)) {
        return;
      }

      setMessageRows((prevRows) => {
        let found = false;
        const nextRows = prevRows.map((row) => {
          if (row.id !== record.id) {
            return row;
          }

          found = true;
          return {
            ...row,
            sentAt: record.sentAt ? datetimeToClient(record.sentAt) : null,
            deliveredAt: record.deliveredAt ? datetimeToClient(record.deliveredAt) : null,
            failedAt: record.failedAt ? datetimeToClient(record.failedAt) : null,
            errorMessage: record.errorMessage || null,
            metaMessageId: record.metaMessageId || null,
            status: getShippingStatus(record)
          };
        });

        return found ? nextRows : prevRows;
      });

      setSelectedFailedShippingIds((prevState) => {
        if (record.failedAt) {
          return prevState;
        }

        return prevState.filter((id) => id !== record.id);
      });
    };

    socket.on(`company-${companyId}-campaign-shipping`, onCampaignShippingEvent);

    return () => {
      socket.off(`company-${companyId}-campaign-shipping`, onCampaignShippingEvent);
    };
  }, [campaignId, datetimeToClient, socket, user.companyId]);

  const findCampaign = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campaigns/${campaignId}`);
      setCampaign(data);

      let shippingData = [];
      try {
        const shippingResponse = await api.get(`/campaigns/${campaignId}/shipping`, {
          params: {
            pageNumber: 1,
            pageSize: 5000
          }
        });

        if (Array.isArray(shippingResponse.data)) {
          shippingData = shippingResponse.data;
        } else if (Array.isArray(shippingResponse.data?.records)) {
          shippingData = shippingResponse.data.records;
        }
      } catch (shippingError) {
        console.error("Erro ao buscar dados de envio:", shippingError);
        if (Array.isArray(data.shipping)) {
          shippingData = data.shipping;
        }
      }

      const formattedRows = shippingData.map(normalizeShippingItem);

      setMessageRows(formattedRows);
      setSelectedFailedShippingIds([]);

      setCampaign(prevCampaign => ({
        ...prevCampaign,
        shipping: shippingData
      }));
    } catch (error) {
      console.error("Erro ao buscar campanha:", error);
      toast.error(i18n.t("campaignReport.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return i18n.t("campaignReport.inactive");
      case "PROGRAMADA":
        return i18n.t("campaignReport.scheduled");
      case "EM_ANDAMENTO":
        return i18n.t("campaignReport.process");
      case "CANCELADA":
        return i18n.t("campaignReport.cancelled");
      case "FINALIZADA":
        return i18n.t("campaignReport.finished");
      default:
        return val;
    }
  };
  
  // Manipuladores para a paginação da tabela
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleToggleFailedShippingSelection = (shippingId) => {
    setSelectedFailedShippingIds((prevState) => {
      if (prevState.includes(shippingId)) {
        return prevState.filter((id) => id !== shippingId);
      }

      return [...prevState, shippingId];
    });
  };

  const handleToggleSelectAllFailed = (checked) => {
    if (!checked) {
      setSelectedFailedShippingIds([]);
      return;
    }

    const failedIds = messageRows
      .filter((row) => row.status === "failed")
      .map((row) => row.id);

    setSelectedFailedShippingIds(failedIds);
  };

  const handleResendFailedShippings = async () => {
    if (!selectedFailedShippingIds.length) {
      toast.info("Selecione ao menos uma linha com falha para reenviar.");
      return;
    }

    const confirmed = window.confirm(
      `Reenviar ${selectedFailedShippingIds.length} envio(s) com falha?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setResendingFailed(true);

      const { data } = await api.post(`/campaigns/${campaignId}/resend-failed`, {
        shippingIds: selectedFailedShippingIds
      });

      toast.success(
        `${data?.requeuedCount || 0} envio(s) reenfileirado(s) para reenvio.`
      );

      if (data?.skippedCount) {
        toast.info(
          `${data.skippedCount} item(ns) foram ignorados por não estarem mais em falha.`
        );
      }

      await findCampaign();
    } catch (error) {
      toast.error("Não foi possível reenviar os itens selecionados.");
    } finally {
      setResendingFailed(false);
    }
  };
  
  // Função para formatar o número de telefone
  const formatPhoneNumber = (number) => {
    if (!number) return '';
    
    // Verifica se é um ID de grupo (normalmente começa com números grandes)
    if (number.length > 15) {
      return `Grupo (${number.substring(0, 6)}...)`;
    }
    
    // Formata número normal
    if (number.length === 12 && number.startsWith('55')) {
      const ddd = number.substring(2, 4);
      const firstPart = number.substring(4, 9);
      const lastPart = number.substring(9);
      return `+55 (${ddd}) ${firstPart}-${lastPart}`;
    }
    
    return number;
  };
  
  // Função para obter o status do envio
  const getMessageStatusChip = (status) => {
    switch (status) {
      case 'delivered':
        return (
          <Chip 
            label="Entregue" 
            size="small" 
            icon={<DoneAllIcon fontSize="small" />} 
            className={`${classes.statusChip} ${classes.deliveredChip}`} 
          />
        );
      case 'pending':
        return (
          <Chip 
            label="Pendente" 
            size="small" 
            icon={<ScheduleIcon fontSize="small" />} 
            className={`${classes.statusChip} ${classes.pendingChip}`} 
          />
        );
      case 'sent':
        return (
          <Chip
            label="Enviada à Meta"
            size="small"
            icon={<SendIcon fontSize="small" />}
            style={{ backgroundColor: "#2196f3", color: "#fff", fontWeight: "bold" }}
          />
        );
      case 'failed':
        return (
          <Chip 
            label="Falhou" 
            size="small" 
            icon={<ErrorIcon fontSize="small" />} 
            className={`${classes.statusChip} ${classes.failedChip}`} 
          />
        );
      default:
        return (
          <Chip 
            label="Desconhecido" 
            size="small" 
            variant="outlined" 
          />
        );
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} item style={{ display: "flex", alignItems: "center" }}>
            <Button
              variant="outlined"
              color="primary"
              style={{ marginRight: 10 }}
              onClick={() => history.push('/campaigns')}
              startIcon={<ArrowBackIcon />}
            >
              {i18n.t("campaignReport.backButton")}
            </Button>
            <Title>{i18n.t("campaignReport.title")} {campaign.name || i18n.t("campaignReport.campaign")}</Title>
          </Grid>
        </Grid>
      </MainHeader>
      
      {/* Card com resumo e status */}
      <Paper className={classes.mainPaper} variant="outlined">
        <Box mb={2}>
          <Typography variant="h5" component="h2" gutterBottom>
            {campaign.name || i18n.t("campaignReport.campaign")}
          </Typography>
          <Chip 
            label={formatStatus(campaign.status)} 
            color={campaign.status === "FINALIZADA" ? "primary" : "default"}
            style={{ fontWeight: 'bold', marginRight: 8 }}
          />
        </Box>
        
        <Grid container spacing={3} className={classes.summaryCards}>
          {/* Card de Status */}
          <Grid item xs={12} md={12} lg={4}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Status de Entrega
                </Typography>
                <Box className={classes.pieChartContainer}>
                  <Doughnut data={chartData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Cards com estatísticas principais */}
          <Grid item xs={12} md={6} lg={2}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <SendIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {statusCounts.attempts}
                </Typography>
                <Typography color="textSecondary">
                  Tentativas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={2}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <MessageIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {statusCounts.sent}
                </Typography>
                <Typography color="textSecondary">
                  Enviadas à Meta
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={2}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <CheckCircleIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {statusCounts.delivered}
                </Typography>
                <Typography color="textSecondary">
                  Mensagens Entregues
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} lg={2}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <ErrorIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {statusCounts.failed}
                </Typography>
                <Typography color="textSecondary">
                  Falhas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Barra de progresso */}
        <Box className={classes.progressContainer}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <Typography variant="body2" color="textSecondary">Processadas</Typography>
            </Grid>
            <Grid item>
              <Typography variant="body2" color="textPrimary">
                {statusCounts.delivered + statusCounts.failed} de {statusCounts.attempts}
              </Typography>
            </Grid>
          </Grid>
          <LinearProgress
            variant="determinate"
            style={{ height: 10, borderRadius: 5, margin: "8px 0" }}
            value={((statusCounts.delivered + statusCounts.failed) / (statusCounts.attempts || 1)) * 100}
          />
        </Box>
        
        {/* Informações adicionais da campanha */}
        <Grid container spacing={3}>
          {campaign.whatsappId && (
            <Grid item xs={12} md={4}>
              <Card variant="outlined" className={classes.detailsCard}>
                <CardHeader
                  avatar={
                    <Avatar className={classes.avatar}>
                      <WhatsAppIcon />
                    </Avatar>
                  }
                  title="Conexão WhatsApp"
                  subheader={campaign.whatsapp?.name || "Não especificado"}
                />
              </Card>
            </Grid>
          )}
          
          {campaign.tagListId && (
            <Grid item xs={12} md={4}>
              <Card variant="outlined" className={classes.detailsCard}>
                <CardHeader
                  avatar={
                    <Avatar className={classes.avatar}>
                      <ListAltIcon />
                    </Avatar>
                  }
                  title="Tag Utilizada"
                  subheader={`ID: ${campaign.tagListId}`}
                />
              </Card>
            </Grid>
          )}
          
          {campaign.contactListId && (
            <Grid item xs={12} md={4}>
              <Card variant="outlined" className={classes.detailsCard}>
                <CardHeader
                  avatar={
                    <Avatar className={classes.avatar}>
                      <ListAltIcon />
                    </Avatar>
                  }
                  title={i18n.t("campaignReport.contactLists")}
                  subheader={campaign.contactList?.name || "Não especificado"}
                />
              </Card>
            </Grid>
          )}
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" className={classes.detailsCard}>
              <CardHeader
                avatar={
                  <Avatar className={classes.avatar}>
                    <ScheduleIcon />
                  </Avatar>
                }
                title={i18n.t("campaignReport.schedule")}
                subheader={datetimeToClient(campaign.scheduledAt) || "Não agendado"}
              />
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" className={classes.detailsCard}>
              <CardHeader
                avatar={
                  <Avatar className={classes.avatar}>
                    <EventAvailableIcon />
                  </Avatar>
                }
                title={i18n.t("campaignReport.conclusion")}
                subheader={datetimeToClient(campaign.completedAt) || "Não concluído"}
              />
            </Card>
          </Grid>
        </Grid>
        
        {/* Seção de detalhes de mensagens */}
        <Box mt={4}>
          <Typography variant="h6" className={classes.sectionTitle}>
            <MessageIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Detalhes das Mensagens
          </Typography>
          <Divider />

          <Box mt={2} mb={1} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
            <Typography variant="body2" color="textSecondary">
              {statusCounts.failed
                ? `${statusCounts.failed} item(ns) com falha.`
                : "Nenhuma falha registrada."}
            </Typography>

            <Button
              variant="contained"
              color="primary"
              onClick={handleResendFailedShippings}
              disabled={!selectedFailedShippingIds.length || resendingFailed}
            >
              {resendingFailed
                ? "Reenviando..."
                : `Reenviar falhas selecionadas (${selectedFailedShippingIds.length})`}
            </Button>
          </Box>
          
          <TableContainer className={classes.tableContainer}>
            <Table aria-label="tabela de mensagens">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      indeterminate={
                        selectedFailedShippingIds.length > 0 &&
                        selectedFailedShippingIds.length < statusCounts.failed
                      }
                      checked={
                        statusCounts.failed > 0 &&
                        selectedFailedShippingIds.length === statusCounts.failed
                      }
                      onChange={(event) => handleToggleSelectAllFailed(event.target.checked)}
                    />
                  </TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Destinatário</TableCell>
                  <TableCell>Mensagem</TableCell>
                  <TableCell>Enviada à Meta em</TableCell>
                  <TableCell>Entregue em</TableCell>
                  <TableCell>Erro</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {messageRows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={selectedFailedShippingIds.includes(row.id)}
                          disabled={row.status !== "failed"}
                          onChange={() => handleToggleFailedShippingSelection(row.id)}
                        />
                      </TableCell>
                      <TableCell>{row.jobId}</TableCell>
                      <TableCell>
                        <Tooltip title={row.number}>
                          <span>{formatPhoneNumber(row.number)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={row.fullMessage}>
                          <span>{row.message}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{row.sentAt || '-'}</TableCell>
                      <TableCell>{row.deliveredAt || '-'}</TableCell>
                      <TableCell>
                        {row.errorMessage ? (
                          <Tooltip title={row.errorMessage}>
                            <span>{row.errorMessage}</span>
                          </Tooltip>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getMessageStatusChip(row.status)}</TableCell>
                    </TableRow>
                  ))}
                {messageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {loading ? "Carregando..." : "Nenhuma mensagem encontrada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={messageRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Linhas por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </TableContainer>
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default CampaignReport;
