import React, { useState, useEffect, useReducer, useContext } from "react";
import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Typography,
    Chip,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Grid
} from "@material-ui/core";
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Refresh as RefreshIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import TemplateModal from "../../components/TemplateModal";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },
    table: {
        minWidth: 650,
    },
    statusChip: {
        minWidth: 100
    },
    categoryChip: {
        minWidth: 80
    },
    selectContainer: {
        marginBottom: theme.spacing(2)
    }
}));

const reducer = (state, action) => {
    switch (action.type) {
        case "LOAD_TEMPLATES":
            return { ...state, templates: action.payload, loading: false };
        case "UPDATE_TEMPLATE":
            const templates = state.templates.map((template) =>
                template.id === action.payload.id ? action.payload : template
            );
            return { ...state, templates };
        case "DELETE_TEMPLATE":
            return {
                ...state,
                templates: state.templates.filter((template) => template.id !== action.payload),
            };
        case "RESET":
            return { ...state, templates: [], loading: true };
        default:
            return state;
    }
};

const Templates = () => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);

    const [state, dispatch] = useReducer(reducer, {
        templates: [],
        loading: false,
    });

    const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
    const [whatsapps, setWhatsapps] = useState([]);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    useEffect(() => {
        fetchWhatsapps();
    }, []);

    useEffect(() => {
        // Só buscar templates se tiver um whatsappId válido
        if (selectedWhatsapp && selectedWhatsapp !== "" && !isNaN(selectedWhatsapp)) {
            fetchTemplates();
        } else {
            dispatch({ type: "RESET" });
        }
    }, [selectedWhatsapp]);

    const fetchWhatsapps = async () => {
        try {
            const { data } = await api.get("/whatsapp");
            // Filtrar apenas conexões da API Oficial
            const oficialWhatsapps = data.filter(w => 
                (w.provider === "oficial" || w.provider === "beta" || 
                 w.channel === "whatsapp_oficial" || w.channel === "whatsapp-oficial") &&
                (w.status === "CONNECTED" || w.status === "OPENING")
            );
            setWhatsapps(oficialWhatsapps);
            
            if (oficialWhatsapps.length > 0 && !selectedWhatsapp) {
                setSelectedWhatsapp(oficialWhatsapps[0].id);
            }
        } catch (err) {
            toastError(err);
        }
    };

    const fetchTemplates = async () => {
        // Verificar se selectedWhatsapp é um número válido
        if (!selectedWhatsapp || selectedWhatsapp === "" || isNaN(selectedWhatsapp)) {
            dispatch({ type: "RESET" });
            return;
        }
        
        try {
            dispatch({ type: "RESET" });
            const { data } = await api.get(`/templates?whatsappId=${selectedWhatsapp}`);
            dispatch({ type: "LOAD_TEMPLATES", payload: data.data || [] });
        } catch (err) {
            dispatch({ type: "LOAD_TEMPLATES", payload: [] });
            toastError(err);
        }
    };

    const handleOpenTemplateModal = (template = null) => {
        setSelectedTemplate(template);
        setTemplateModalOpen(true);
    };

    const handleCloseTemplateModal = () => {
        setSelectedTemplate(null);
        setTemplateModalOpen(false);
    };

    const handleSaveTemplate = () => {
        fetchTemplates();
    };

    const handleDeleteTemplate = (template) => {
        setTemplateToDelete(template);
        setConfirmModalOpen(true);
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;

        try {
            await api.delete(`/templates/${selectedWhatsapp}/${templateToDelete.name}`);
            dispatch({ type: "DELETE_TEMPLATE", payload: templateToDelete.id });
            toast.success("Template deletado com sucesso!");
        } catch (err) {
            toastError(err);
        } finally {
            setConfirmModalOpen(false);
            setTemplateToDelete(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case "APPROVED":
                return "primary";
            case "PENDING":
                return "default";
            case "REJECTED":
                return "secondary";
            default:
                return "default";
        }
    };

    const getCategoryColor = (category) => {
        switch (category?.toUpperCase()) {
            case "MARKETING":
                return "primary";
            case "UTILITY":
                return "default";
            case "AUTHENTICATION":
                return "secondary";
            default:
                return "default";
        }
    };

    const getStatusLabel = (status) => {
        switch (status?.toUpperCase()) {
            case "APPROVED":
                return "Aprovado";
            case "PENDING":
                return "Pendente";
            case "REJECTED":
                return "Rejeitado";
            case "DISABLED":
                return "Desabilitado";
            default:
                return status || "Desconhecido";
        }
    };

    const getCategoryLabel = (category) => {
        switch (category?.toUpperCase()) {
            case "MARKETING":
                return "Marketing";
            case "UTILITY":
                return "Utilidade";
            case "AUTHENTICATION":
                return "Autenticação";
            default:
                return category || "Não definida";
        }
    };

    return (
        <MainContainer>
            <MainHeader>
                <Title>{i18n.t("templates.title")}</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<RefreshIcon />}
                        onClick={fetchTemplates}
                        disabled={!selectedWhatsapp}
                    >
                        Atualizar
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenTemplateModal()}
                        disabled={!selectedWhatsapp}
                    >
                        {i18n.t("templates.buttons.add")}
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">
                <Box className={classes.selectContainer}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Conexão WhatsApp</InputLabel>
                                <Select
                                    value={selectedWhatsapp}
                                    onChange={(e) => setSelectedWhatsapp(e.target.value)}
                                    label="Conexão WhatsApp"
                                >
                                    {whatsapps.map((whatsapp) => (
                                        <MenuItem key={whatsapp.id} value={whatsapp.id}>
                                            {whatsapp.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="textSecondary">
                                {state.templates.length} templates encontrados
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>

                <Table className={classes.table}>
                    <TableHead>
                        <TableRow>
                            <TableCell>Nome</TableCell>
                            <TableCell>Categoria</TableCell>
                            <TableCell>Idioma</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {state.loading && <TableRowSkeleton columns={5} />}
                        {state.templates.map((template) => (
                            <TableRow key={template.id}>
                                <TableCell>
                                    <Typography variant="subtitle2">
                                        {template.name}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={getCategoryLabel(template.category)}
                                        color={getCategoryColor(template.category)}
                                        size="small"
                                        className={classes.categoryChip}
                                    />
                                </TableCell>
                                <TableCell>{template.language}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={getStatusLabel(template.status)}
                                        color={getStatusColor(template.status)}
                                        size="small"
                                        className={classes.statusChip}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="Editar">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenTemplateModal(template)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Deletar">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDeleteTemplate(template)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!state.loading && state.templates.length === 0 && selectedWhatsapp && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography variant="body2" color="textSecondary">
                                        Nenhum template encontrado
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {!selectedWhatsapp && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography variant="body2" color="textSecondary">
                                        Selecione uma conexão WhatsApp para ver os templates
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            <TemplateModal
                open={templateModalOpen}
                onClose={handleCloseTemplateModal}
                templateId={selectedTemplate?.id}
                whatsappId={selectedWhatsapp}
                onSave={handleSaveTemplate}
            />

            <ConfirmationModal
                title="Deletar Template"
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={confirmDeleteTemplate}
            >
                Tem certeza que deseja deletar o template "{templateToDelete?.name}"?
                Esta ação não pode ser desfeita.
            </ConfirmationModal>
        </MainContainer>
    );
};

export default Templates;
