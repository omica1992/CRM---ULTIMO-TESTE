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
  IconButton,
  Chip,
  Avatar,
  Tooltip
} from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import SendIcon from "@material-ui/icons/Send";
import PhoneIcon from "@material-ui/icons/Phone";
import MessageIcon from "@material-ui/icons/Message";
import ScheduleIcon from "@material-ui/icons/Schedule";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import DoneIcon from "@material-ui/icons/Done";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ListAltIcon from "@material-ui/icons/ListAlt";
import PieChartIcon from '@material-ui/icons/PieChart';
import BarChartIcon from '@material-ui/icons/BarChart';
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { has, get, isNull } from "lodash";
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
import { Line, Pie, Doughnut } from 'react-chartjs-2';

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
  const [validContacts, setValidContacts] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [confirmationRequested, setConfirmationRequested] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [messageRows, setMessageRows] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [uniqueNumbers, setUniqueNumbers] = useState(0);
  const [failedMessages, setFailedMessages] = useState(0);
  const mounted = useRef(true);
  const { user, socket } = useContext(AuthContext);

  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();
  
  // Dados para o gráfico de pizza
  const [chartData, setChartData] = useState({
    labels: ['Entregues', 'Aguardando', 'Falhas'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(255, 99, 132, 0.7)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  });
  
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
    if (mounted.current) {
      if (has(campaign, "contactList") && has(campaign.contactList, "contacts")) {
        const contactList = get(campaign, "contactList");
        const valids = contactList.contacts.filter((c) => c.isWhatsappValid);
        setValidContacts(valids.length);
      } else if (has(campaign, "tagListId")) {
        // Se estamos usando tags em vez de listas de contato
        setValidContacts(delivered); // Usamos as entregas como contatos válidos
      }

      if (has(campaign, "shipping") && Array.isArray(campaign.shipping)) {
        const contacts = get(campaign, "shipping");
        const delivered = contacts.filter((c) => !isNull(c.deliveredAt));
        const confirmationRequested = contacts.filter(
          (c) => !isNull(c.confirmationRequestedAt)
        );
        const confirmed = contacts.filter(
          (c) => !isNull(c.deliveredAt) && !isNull(c.confirmationRequestedAt)
        );
        setDelivered(delivered.length);
        setConfirmationRequested(confirmationRequested.length);
        setConfirmed(confirmed.length);
      }
    }
  }, [campaign]);

  useEffect(() => {
    // Evitar divisão por zero
    if (validContacts > 0) {
      setPercent((delivered / validContacts) * 100);
    } else {
      setPercent(0);
    }
  }, [delivered, validContacts]);

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

  const findCampaign = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campaigns/${campaignId}`);
      setCampaign(data);
      
      // Se não tiver contactList nem shipping, tente obter os envios separadamente
      if (!has(data, "shipping")) {
        try {
          const shippingResponse = await api.get(`/campaigns/${campaignId}/shipping`);
          if (shippingResponse.data && Array.isArray(shippingResponse.data)) {
            const shippingData = shippingResponse.data;
            
            // Processar dados para a tabela
            const formattedRows = shippingData.map(item => ({
              id: item.id,
              jobId: item.jobId,
              number: item.number,
              message: item.message ? item.message.substring(0, 50) + (item.message.length > 50 ? '...' : '') : '',
              fullMessage: item.message || '',
              deliveredAt: item.deliveredAt ? datetimeToClient(item.deliveredAt) : null,
              createdAt: item.createdAt ? datetimeToClient(item.createdAt) : null,
              status: item.deliveredAt ? 'delivered' : 'pending'
            }));
            
            setMessageRows(formattedRows);
            
            // Atualizar contadores
            const delivered = shippingData.filter(item => item.deliveredAt).length;
            const pending = shippingData.length - delivered;
            const failed = 0; // Adicionar lógica para falhas se disponível na API
            
            // Contar números únicos
            const uniquePhoneNumbers = new Set(shippingData.map(item => item.number)).size;
            setUniqueNumbers(uniquePhoneNumbers);
            setFailedMessages(failed);
            
            // Atualizar dados do gráfico
            setChartData({
              labels: ['Entregues', 'Aguardando', 'Falhas'],
              datasets: [
                {
                  data: [delivered, pending, failed],
                  backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                  ],
                  borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)',
                  ],
                  borderWidth: 1,
                },
              ],
            });
            
            setCampaign(prevCampaign => ({
              ...prevCampaign,
              shipping: shippingData
            }));
          }
        } catch (shippingError) {
          console.error("Erro ao buscar dados de envio:", shippingError);
        }
      } else if (Array.isArray(data.shipping)) {
        const shippingData = data.shipping;
        
        // Processar dados para a tabela
        const formattedRows = shippingData.map(item => ({
          id: item.id,
          jobId: item.jobId,
          number: item.number,
          message: item.message ? item.message.substring(0, 50) + (item.message.length > 50 ? '...' : '') : '',
          fullMessage: item.message || '',
          deliveredAt: item.deliveredAt ? datetimeToClient(item.deliveredAt) : null,
          createdAt: item.createdAt ? datetimeToClient(item.createdAt) : null,
          status: item.deliveredAt ? 'delivered' : 'pending'
        }));
        
        setMessageRows(formattedRows);
        
        // Atualizar contadores
        const delivered = shippingData.filter(item => item.deliveredAt).length;
        const pending = shippingData.length - delivered;
        const failed = 0; // Adicionar lógica para falhas se disponível na API
        
        // Contar números únicos
        const uniquePhoneNumbers = new Set(shippingData.map(item => item.number)).size;
        setUniqueNumbers(uniquePhoneNumbers);
        setFailedMessages(failed);
        
        // Atualizar dados do gráfico
        setChartData({
          labels: ['Entregues', 'Aguardando', 'Falhas'],
          datasets: [
            {
              data: [delivered, pending, failed],
              backgroundColor: [
                'rgba(75, 192, 192, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(255, 99, 132, 0.7)',
              ],
              borderColor: [
                'rgba(75, 192, 192, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(255, 99, 132, 1)',
              ],
              borderWidth: 1,
            },
          ],
        });
      }
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
      case 'failed':
        return (
          <Chip 
            label="Falha" 
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
          <Grid item xs={12} md={6} lg={3}>
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
          <Grid item xs={12} md={6} lg={3}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <SendIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {messageRows.length}
                </Typography>
                <Typography color="textSecondary">
                  Mensagens Enviadas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <PhoneIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {uniqueNumbers}
                </Typography>
                <Typography color="textSecondary">
                  Destinatários Únicos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card className={classes.summaryCard} variant="outlined">
              <CardContent>
                <CheckCircleIcon className={classes.cardIcon} />
                <Typography variant="h4" component="div">
                  {messageRows.filter(row => row.status === 'delivered').length}
                </Typography>
                <Typography color="textSecondary">
                  Mensagens Entregues
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* Barra de progresso */}
        <Box className={classes.progressContainer}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <Typography variant="body2" color="textSecondary">{i18n.t("campaignReport.deliver")}</Typography>
            </Grid>
            <Grid item>
              <Typography variant="body2" color="textPrimary">
                {messageRows.filter(row => row.status === 'delivered').length} de {messageRows.length}
              </Typography>
            </Grid>
          </Grid>
          <LinearProgress
            variant="determinate"
            style={{ height: 10, borderRadius: 5, margin: "8px 0" }}
            value={(messageRows.filter(row => row.status === 'delivered').length / (messageRows.length || 1)) * 100}
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
          
          <TableContainer className={classes.tableContainer}>
            <Table aria-label="tabela de mensagens">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Destinatário</TableCell>
                  <TableCell>Mensagem</TableCell>
                  <TableCell>Enviado em</TableCell>
                  <TableCell>Entregue em</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {messageRows
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row) => (
                    <TableRow key={row.id}>
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
                      <TableCell>{row.createdAt}</TableCell>
                      <TableCell>{row.deliveredAt || '-'}</TableCell>
                      <TableCell>{getMessageStatusChip(row.status)}</TableCell>
                    </TableRow>
                  ))}
                {messageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
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
