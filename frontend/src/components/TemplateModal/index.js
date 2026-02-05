import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Chip,
    IconButton,
    CardContent,
    FormHelperText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Divider,
    Grid,
    Card
} from "@material-ui/core";
import {
    Close as CloseIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    CloudUpload as CloudUploadIcon,
    Image as ImageIcon,
    Link as LinkIcon,
    Phone as PhoneIcon,
    Code as CodeIcon,
    Message as MessageIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { Formik, Form, Field, FieldArray } from "formik";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
    dialog: {
        '& .MuiDialog-paper': {
            minHeight: '600px',
            maxHeight: '90vh',
            width: '100%',
            maxWidth: '800px'
        }
    },
    formControl: {
        marginBottom: theme.spacing(2),
        minWidth: '100%'
    },
    componentCard: {
        marginBottom: theme.spacing(2),
        border: `1px solid ${theme.palette.divider}`
    },
    componentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing(1)
    },
    addButton: {
        marginTop: theme.spacing(1)
    },
    chipContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(0.5),
        marginTop: theme.spacing(1)
    },
    exampleField: {
        marginTop: theme.spacing(1)
    },
    uploadButton: {
        marginTop: theme.spacing(2)
    },
    imagePreview: {
        marginTop: theme.spacing(2),
        maxWidth: '100%',
        maxHeight: 200,
        objectFit: 'contain',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 4
    },
    uploadBox: {
        marginTop: theme.spacing(2),
        padding: theme.spacing(2),
        border: `2px dashed ${theme.palette.divider}`,
        borderRadius: 4,
        textAlign: 'center',
        cursor: 'pointer',
        '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.action.hover
        }
    }
}));

const componentTypes = [
    { value: 'HEADER', label: 'Cabeçalho' },
    { value: 'BODY', label: 'Corpo' },
    { value: 'FOOTER', label: 'Rodapé' },
    { value: 'BUTTONS', label: 'Botões' }
];

const categories = [
    { value: 'AUTHENTICATION', label: 'Autenticação' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'UTILITY', label: 'Utilidade' }
];

const languages = [
    { value: 'pt_BR', label: 'Português (Brasil)' },
    { value: 'en_US', label: 'Inglês (EUA)' },
    { value: 'es_ES', label: 'Espanhol' }
];

const buttonTypes = [
    { value: 'QUICK_REPLY', label: 'Resposta Rápida' },
    { value: 'URL', label: 'Link' },
    { value: 'PHONE_NUMBER', label: 'Telefone' },
    { value: 'COPY_CODE', label: 'Copiar Código' }
];

const availableVariables = [
    { name: 'Nome', value: '{{name}}' },
    { name: 'Primeiro Nome', value: '{{firstName}}' },
    { name: 'Saudação', value: '{{ms}}' },
    { name: 'Protocolo', value: '{{protocol}}' },
    { name: 'Hora', value: '{{hour}}' },
    { name: 'Data', value: '{{date}}' },
];

const TemplateModal = ({ open, onClose, templateId, whatsappId, onSave }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [initialValues, setInitialValues] = useState({
        name: "",
        category: "",
        language: "pt_BR",
        parameter_format: "positional",
        components: [
            {
                type: "BODY",
                text: ""
                // ✅ Não criar example vazio - será adicionado apenas se houver variáveis
            }
        ]
    });

    useEffect(() => {
        if (templateId && open) {
            fetchTemplate();
        } else if (open) {
            setInitialValues({
                name: "",
                category: "",
                language: "pt_BR",
                parameter_format: "positional",
                components: [
                    {
                        type: "BODY",
                        text: ""
                        // ✅ Não criar example vazio
                    }
                ]
            });
        }
    }, [templateId, open]);

    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/templates/${whatsappId}/${templateId}`);
            setInitialValues({
                name: data.name || "",
                category: data.category || "",
                language: data.language || "pt_BR",
                parameter_format: data.parameter_format || "positional",
                components: data.components || []
            });
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            // Validação do nome
            if (!values.name || values.name.trim() === '') {
                toast.error("Nome do template é obrigatório");
                return;
            }

            if (!/^[a-z0-9_]+$/.test(values.name)) {
                toast.error("Nome deve conter apenas letras minúsculas, números e underscore (_)");
                return;
            }

            if (values.name.length > 512) {
                toast.error("Nome deve ter no máximo 512 caracteres");
                return;
            }

            // Validação da categoria
            if (!values.category) {
                toast.error("Categoria é obrigatória");
                return;
            }

            // Validação do idioma
            if (!values.language) {
                toast.error("Idioma é obrigatório");
                return;
            }

            // Validação manual dos componentes
            if (!values.components || values.components.length === 0) {
                toast.error("Adicione pelo menos um componente ao template");
                return;
            }

            // Verificar se tem pelo menos um BODY
            const hasBody = values.components.some(c => c.type === 'BODY');
            if (!hasBody) {
                toast.error("O template deve ter pelo menos um componente BODY");
                return;
            }

            // Validar cada componente
            for (let i = 0; i < values.components.length; i++) {
                const component = values.components[i];

                // HEADER com formato de mídia precisa ter example.header_handle
                if (component.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format)) {
                    if (!component.example?.header_handle || !Array.isArray(component.example.header_handle) || component.example.header_handle.length === 0) {
                        toast.error(`O cabeçalho com ${component.format === 'IMAGE' ? 'imagem' : component.format === 'VIDEO' ? 'vídeo' : 'documento'} precisa ter a mídia carregada`);
                        return;
                    }
                    continue; // Não precisa de texto
                }

                // HEADER com formato TEXT ou sem formato precisa de texto
                if (component.type === 'HEADER' && (!component.format || component.format === 'TEXT')) {
                    if (!component.text || component.text.trim() === '') {
                        toast.error('O cabeçalho precisa ter texto ou mídia');
                        return;
                    }
                    continue;
                }

                // Outros componentes precisam de texto
                if (!component.text || component.text.trim() === '') {
                    toast.error(`O componente ${componentTypes.find(t => t.value === component.type)?.label || component.type} precisa de texto`);
                    return;
                }
            }

            // ✅ CORREÇÃO: Converter variáveis nomeadas para posicionais ({{name}} -> {{1}})
            // para garantir aprovação da Meta
            // ✅ CORREÇÃO: Suporte a parâmetros nomeados e posicionais
            const processComponents = (components) => {
                return components.map(component => {
                    if (component.type === 'BODY' || component.type === 'HEADER' || component.type === 'FOOTER') {
                        if (component.text) {
                            // Se for posicional, faz a conversão para garantir compatibilidade
                            if (values.parameter_format === 'positional') {
                                let variableCount = 1;
                                const variableMap = new Map();

                                const newText = component.text.replace(/\{\{([^{}]+)\}\}/g, (match, variable) => {
                                    const varName = variable.trim();
                                    if (!isNaN(varName)) return match; // Já é número
                                    if (!variableMap.has(varName)) {
                                        variableMap.set(varName, variableCount++);
                                    }
                                    return `{{${variableMap.get(varName)}}}`;
                                });

                                // Gera exemplos para posicionais
                                let example = component.example;
                                if (component.type === 'BODY' && variableCount > 1) {
                                    const examples = Array(variableCount - 1).fill("Exemplo");
                                    example = { body_text: [examples] };
                                }
                                return { ...component, text: newText, example };
                            }
                            // Se for nomeado, mantém as variáveis originais
                            else {
                                // Encontrar variáveis no texto
                                const variables = [...component.text.matchAll(/\{\{([^{}]+)\}\}/g)].map(m => m[1].trim());
                                const uniqueVariables = [...new Set(variables)];

                                // Gera exemplos nomeados para BODY
                                let example = component.example;
                                if (component.type === 'BODY' && uniqueVariables.length > 0) {
                                    // Para parâmetros nomeados, deve-se usar body_text_named_params
                                    const examples = uniqueVariables.map(varName => ({
                                        param_name: varName,
                                        example: "Exemplo"
                                    }));
                                    example = { body_text_named_params: examples };
                                }
                                return { ...component, example };
                            }
                        }
                    }
                    return component;
                });
            };

            const processedComponents = processComponents(values.components);

            const valuesToSend = {
                ...values,
                components: processedComponents,
                // parameter_format já vem de values (positional ou named)
            };

            setLoading(true);

            console.log('[TEMPLATE MODAL] Enviando template (Processado):', JSON.stringify(valuesToSend, null, 2));

            if (templateId) {
                await api.put(`/templates/${whatsappId}/${templateId}`, valuesToSend);
                toast.success("Template atualizado com sucesso!");
            } else {
                await api.post(`/templates/${whatsappId}`, valuesToSend);
                toast.success("Template criado com sucesso!");
            }

            onSave();
            onClose();
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };

    const addComponent = (push) => {
        push({
            type: "BODY",
            text: ""
            // ✅ Não criar example vazio - será adicionado apenas se houver variáveis
        });
    };

    const addButton = (component, index, setFieldValue) => {
        const buttons = component.buttons || [];
        buttons.push({
            type: "QUICK_REPLY",
            text: ""
        });
        setFieldValue(`components[${index}].buttons`, buttons);
    };

    const addOptOutButton = (component, index, setFieldValue) => {
        const buttons = component.buttons || [];
        buttons.push({
            type: "QUICK_REPLY",
            text: "Parar promoções"
        });
        setFieldValue(`components[${index}].buttons`, buttons);
    };

    const removeButton = (component, buttonIndex, index, setFieldValue) => {
        const buttons = [...(component.buttons || [])];
        buttons.splice(buttonIndex, 1);
        setFieldValue(`components[${index}].buttons`, buttons);
    };

    const handleMediaUpload = async (event, index, setFieldValue) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Tipo de arquivo não suportado. Use: JPEG, PNG, GIF, WEBP, MP4 ou PDF');
            return;
        }

        // Validar tamanho (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Arquivo muito grande. Tamanho máximo: 5MB');
            return;
        }

        try {
            setUploadingMedia(true);
            const formData = new FormData();
            formData.append('file', file);

            // ✅ CORREÇÃO: Adicionar parâmetros para upload na Meta API
            formData.append('uploadToMeta', 'true');

            // Buscar dados da conexão WhatsApp
            const { data: whatsappData } = await api.get(`/whatsapp/${whatsappId}`);

            console.log('[TEMPLATE MODAL] 📋 Resposta completa da API /whatsapp:', whatsappData);

            // ✅ Usar o token da conexão (api_oficial vai buscar credenciais corretas do próprio banco)
            const whatsappToken = whatsappData.token;

            console.log('[TEMPLATE MODAL] 📋 Dados da conexão:', {
                hasToken: !!whatsappToken,
                token: whatsappToken || 'VAZIO',
                provider: whatsappData.provider,
                channel: whatsappData.channel
            });

            if (whatsappToken) {
                formData.append('whatsappToken', whatsappToken);
                console.log('[TEMPLATE MODAL] 🚀 Upload para Meta API habilitado via api_oficial');
                console.log('[TEMPLATE MODAL] 🔑 Token da conexão:', whatsappToken);
            } else {
                console.warn('[TEMPLATE MODAL] ⚠️ Token da conexão não encontrado, usando apenas upload local');
            }

            console.log('[TEMPLATE MODAL] Enviando arquivo:', {
                name: file.name,
                type: file.type,
                size: file.size,
                uploadToMeta: !!whatsappToken
            });

            const { data } = await api.post('/templates/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log('[TEMPLATE MODAL] Upload bem-sucedido:', data);

            // Determinar o formato baseado no tipo de arquivo
            let format = 'IMAGE';
            if (file.type.startsWith('video/')) format = 'VIDEO';
            if (file.type === 'application/pdf') format = 'DOCUMENT';

            // ✅ CORREÇÃO: Usar metaHandle se disponível, senão usar publicUrl
            const handleValue = data.metaHandle || data.publicUrl;

            if (data.metaHandle) {
                console.log('[TEMPLATE MODAL] ✅ Usando Meta Handle (CORRETO):', data.metaHandle);
                toast.success('Mídia enviada com sucesso! Handle da Meta gerado.');
            } else {
                console.warn('[TEMPLATE MODAL] ⚠️ Usando URL local (pode não funcionar):', data.publicUrl);
                toast.warning('Mídia salva localmente. Recomenda-se configurar tokenAPI e wabaId para garantir aprovação.');
            }

            // Atualizar o componente com o handle ou URL
            setFieldValue(`components[${index}].format`, format);
            setFieldValue(`components[${index}].example`, {
                header_handle: [handleValue]
            });

            console.log('[TEMPLATE MODAL] Componente atualizado:', {
                format,
                example: { header_handle: [handleValue] },
                isMetaHandle: !!data.metaHandle
            });

        } catch (err) {
            console.error('[TEMPLATE MODAL] Erro no upload:', err);
            console.error('[TEMPLATE MODAL] Detalhes do erro:', err.response?.data);
            toastError(err);
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleAddVariable = (componentIndex, variableValue, setFieldValue, currentText) => {
        const newValue = currentText + variableValue;
        setFieldValue(`components[${componentIndex}].text`, newValue);
    };

    const handleQuickAddButton = (type, values, setFieldValue, push) => {
        let buttonsComponentIndex = values.components.findIndex(c => c.type === 'BUTTONS');
        let buttonObj = {};

        switch (type) {
            case 'URL':
                buttonObj = { type: 'URL', text: '', url: '' };
                break;
            case 'PHONE_NUMBER':
                buttonObj = { type: 'PHONE_NUMBER', text: '', phone_number: '' };
                break;
            case 'COPY_CODE':
                buttonObj = { type: 'COPY_CODE', text: 'Copiar Código', example: [] };
                break;
            case 'QUICK_REPLY':
            default:
                buttonObj = { type: 'QUICK_REPLY', text: '' };
                break;
        }

        if (buttonsComponentIndex === -1) {
            // Criar componente de botões se não existir
            push({
                type: 'BUTTONS',
                buttons: [buttonObj]
            });
        } else {
            // Adicionar ao componente existente
            const currentButtons = values.components[buttonsComponentIndex].buttons || [];

            // Verificações de limites (simplificadas)
            if (currentButtons.length >= 10) { // Limite teórico da interface, meta valida 3 para marketing
                toast.error("Limite de botões atingido");
                return;
            }

            // Copia o array para não mutar estado diretamente (Formik lida com isso, mas é bom garantir)
            const newButtons = [...currentButtons, buttonObj];
            setFieldValue(`components[${buttonsComponentIndex}].buttons`, newButtons);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            className={classes.dialog}
        >
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                        {templateId ? "Editar Template" : "Criar Template"}
                    </Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <Formik
                initialValues={initialValues}
                onSubmit={handleSubmit}
                enableReinitialize
                validate={() => ({})}
            >
                {({ values, errors, touched, setFieldValue }) => (
                    <Form>
                        <DialogContent dividers>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Field name="name">
                                        {({ field, form }) => (
                                            <TextField
                                                {...field}
                                                label="Nome do Template"
                                                fullWidth
                                                error={touched.name && !!errors.name}
                                                helperText={
                                                    (touched.name && errors.name) ||
                                                    "Apenas letras minúsculas, números e underscore (_)"
                                                }
                                                disabled={!!templateId}
                                                onChange={(e) => {
                                                    // Normalizar: converter para minúsculas e remover caracteres inválidos
                                                    const normalized = e.target.value
                                                        .toLowerCase()
                                                        .replace(/[^a-z0-9_]/g, '');
                                                    form.setFieldValue('name', normalized);
                                                }}
                                                inputProps={{
                                                    maxLength: 512
                                                }}
                                            />
                                        )}
                                    </Field>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Field name="category">
                                        {({ field }) => (
                                            <FormControl fullWidth error={touched.category && !!errors.category}>
                                                <InputLabel>Categoria</InputLabel>
                                                <Select {...field}>
                                                    {categories.map(cat => (
                                                        <MenuItem key={cat.value} value={cat.value}>
                                                            {cat.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                                {touched.category && errors.category && (
                                                    <FormHelperText>{errors.category}</FormHelperText>
                                                )}
                                            </FormControl>
                                        )}
                                    </Field>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Field name="language">
                                        {({ field }) => (
                                            <FormControl fullWidth>
                                                <InputLabel>Idioma</InputLabel>
                                                <Select {...field} disabled={!!templateId}>
                                                    {languages.map(lang => (
                                                        <MenuItem key={lang.value} value={lang.value}>
                                                            {lang.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Field>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Field name="parameter_format">
                                        {({ field }) => (
                                            <FormControl fullWidth>
                                                <InputLabel>Formato de Parâmetros</InputLabel>
                                                <Select {...field}>
                                                    <MenuItem value="positional">Posicional ({"{1}"}, {"{2}"})</MenuItem>
                                                    <MenuItem value="named">Nomeado ({"{nome}"}, {"{data}"})</MenuItem>
                                                </Select>
                                            </FormControl>
                                        )}
                                    </Field>
                                </Grid>
                            </Grid>

                            <Divider style={{ margin: '24px 0' }} />

                            <Typography variant="h6" gutterBottom>
                                Componentes do Template
                            </Typography>

                            <FieldArray name="components">
                                {({ push, remove }) => (
                                    <>
                                        <Box mb={2} display="flex" gap={1} flexWrap="wrap">
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                size="small"
                                                startIcon={<LinkIcon />}
                                                onClick={() => handleQuickAddButton('URL', values, setFieldValue, push)}
                                            >
                                                Website
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                size="small"
                                                startIcon={<PhoneIcon />}
                                                onClick={() => handleQuickAddButton('PHONE_NUMBER', values, setFieldValue, push)}
                                            >
                                                Telefone
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="default"
                                                size="small"
                                                startIcon={<CodeIcon />}
                                                onClick={() => handleQuickAddButton('COPY_CODE', values, setFieldValue, push)}
                                            >
                                                Copiar Código
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="default"
                                                size="small"
                                                startIcon={<MessageIcon />}
                                                onClick={() => handleQuickAddButton('QUICK_REPLY', values, setFieldValue, push)}
                                            >
                                                Resposta Rápida
                                            </Button>
                                        </Box>
                                        {values.components.map((component, index) => (
                                            <Card key={index} className={classes.componentCard}>
                                                <CardContent>
                                                    <Box className={classes.componentHeader}>
                                                        <Field name={`components[${index}].type`}>
                                                            {({ field }) => (
                                                                <FormControl style={{ minWidth: 200 }}>
                                                                    <InputLabel>Tipo</InputLabel>
                                                                    <Select {...field}>
                                                                        {componentTypes.map(type => (
                                                                            <MenuItem key={type.value} value={type.value}>
                                                                                {type.label}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            )}
                                                        </Field>

                                                        <IconButton
                                                            onClick={() => remove(index)}
                                                            disabled={values.components.length === 1}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Box>

                                                    {/* Upload de Mídia para HEADER */}
                                                    {component.type === 'HEADER' && (
                                                        <Box mt={2}>
                                                            <Typography variant="subtitle2" gutterBottom>
                                                                Mídia do Cabeçalho (Opcional)
                                                            </Typography>
                                                            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                                                                ℹ️ O cabeçalho pode ter OU texto OU mídia, nunca os dois. Ao adicionar mídia, o campo de texto será ocultado.
                                                            </Typography>

                                                            {/* Alerta se tem formato mas não tem mídia */}
                                                            {component.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format) &&
                                                                (!component.example?.header_handle || component.example.header_handle.length === 0) && (
                                                                    <Box mt={1} mb={1} p={1} bgcolor="#fff3cd" borderRadius={4}>
                                                                        <Typography variant="caption" style={{ color: '#856404' }}>
                                                                            ⚠️ Formato {component.format} selecionado mas mídia não carregada. Faça upload da mídia abaixo.
                                                                        </Typography>
                                                                    </Box>
                                                                )}
                                                            <input
                                                                accept="image/*,video/mp4,application/pdf"
                                                                style={{ display: 'none' }}
                                                                id={`media-upload-${index}`}
                                                                type="file"
                                                                onChange={(e) => handleMediaUpload(e, index, setFieldValue)}
                                                                disabled={uploadingMedia}
                                                            />
                                                            <label htmlFor={`media-upload-${index}`}>
                                                                <Box className={classes.uploadBox}>
                                                                    {uploadingMedia ? (
                                                                        <CircularProgress size={24} />
                                                                    ) : (
                                                                        <>
                                                                            <CloudUploadIcon style={{ fontSize: 48, color: '#999' }} />
                                                                            <Typography variant="body2" color="textSecondary">
                                                                                Clique para fazer upload de imagem, vídeo ou documento
                                                                            </Typography>
                                                                            <Typography variant="caption" color="textSecondary">
                                                                                Formatos: JPEG, PNG, GIF, WEBP, MP4, PDF (máx 5MB)
                                                                            </Typography>
                                                                        </>
                                                                    )}
                                                                </Box>
                                                            </label>

                                                            {/* Preview da mídia */}
                                                            {component.example?.header_handle?.[0] && (
                                                                <Box mt={2}>
                                                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                                        <Typography variant="caption" color="textSecondary">
                                                                            Mídia carregada:
                                                                        </Typography>
                                                                        <Button
                                                                            size="small"
                                                                            color="secondary"
                                                                            startIcon={<DeleteIcon />}
                                                                            onClick={() => {
                                                                                setFieldValue(`components[${index}].format`, null);
                                                                                setFieldValue(`components[${index}].example`, null);
                                                                            }}
                                                                        >
                                                                            Remover Mídia
                                                                        </Button>
                                                                    </Box>
                                                                    {component.format === 'IMAGE' && (
                                                                        <img
                                                                            src={component.example.header_handle[0]}
                                                                            alt="Preview"
                                                                            className={classes.imagePreview}
                                                                        />
                                                                    )}
                                                                    {component.format === 'VIDEO' && (
                                                                        <video
                                                                            src={component.example.header_handle[0]}
                                                                            controls
                                                                            className={classes.imagePreview}
                                                                        />
                                                                    )}
                                                                    {component.format === 'DOCUMENT' && (
                                                                        <Box display="flex" alignItems="center" mt={1}>
                                                                            <ImageIcon />
                                                                            <Typography variant="body2" style={{ marginLeft: 8 }}>
                                                                                {component.example.header_handle[0].split('/').pop()}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                    <Typography variant="caption" display="block" color="textSecondary" style={{ wordBreak: 'break-all' }}>
                                                                        {component.example.header_handle[0]}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    )}

                                                    {/* Campo de texto (para todos os tipos exceto HEADER com mídia) */}
                                                    {(component.type !== 'HEADER' || !component.format) && (
                                                        <Field name={`components[${index}].text`}>
                                                            {({ field }) => (
                                                                <div>
                                                                    <TextField
                                                                        {...field}
                                                                        label="Texto"
                                                                        fullWidth
                                                                        multiline
                                                                        rows={3}
                                                                        helperText={`Use {1}, {2} para parâmetros posicionais ou use as variáveis abaixo`}
                                                                        style={{ marginTop: 16 }}
                                                                    />
                                                                    <Grid container spacing={1} style={{ marginTop: 8 }}>
                                                                        {availableVariables.map((variable) => (
                                                                            <Grid item key={variable.value}>
                                                                                <Chip
                                                                                    label={variable.name}
                                                                                    // icon={<AddIcon />}
                                                                                    size="small"
                                                                                    color="primary"
                                                                                    variant="outlined"
                                                                                    onClick={() => handleAddVariable(index, variable.value, setFieldValue, field.value)}
                                                                                    clickable
                                                                                />
                                                                            </Grid>
                                                                        ))}
                                                                    </Grid>
                                                                </div>
                                                            )}
                                                        </Field>
                                                    )}

                                                    {component.type === 'BUTTONS' && (
                                                        <Box mt={2}>
                                                            <Typography variant="subtitle2" gutterBottom>
                                                                Botões
                                                            </Typography>
                                                            {(component.buttons || []).map((button, buttonIndex) => (
                                                                <Box key={buttonIndex} mb={2} p={2} border={1} borderColor="divider" borderRadius={4}>
                                                                    <Grid container spacing={2} alignItems="center">
                                                                        <Grid item xs={12} sm={4}>
                                                                            <FormControl fullWidth>
                                                                                <InputLabel>Tipo</InputLabel>
                                                                                <Select
                                                                                    value={button.type}
                                                                                    onChange={(e) => setFieldValue(
                                                                                        `components[${index}].buttons[${buttonIndex}].type`,
                                                                                        e.target.value
                                                                                    )}
                                                                                >
                                                                                    {buttonTypes.map(type => (
                                                                                        <MenuItem key={type.value} value={type.value}>
                                                                                            {type.label}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </Select>
                                                                            </FormControl>
                                                                        </Grid>
                                                                        <Grid item xs={12} sm={6}>
                                                                            <TextField
                                                                                label="Texto do Botão"
                                                                                fullWidth
                                                                                value={button.text}
                                                                                onChange={(e) => setFieldValue(
                                                                                    `components[${index}].buttons[${buttonIndex}].text`,
                                                                                    e.target.value
                                                                                )}
                                                                                helperText={button.type === 'COPY_CODE' ? "Texto que aparece no botão (ex: Copiar Código)" : ""}
                                                                            />
                                                                        </Grid>
                                                                        <Grid item xs={12} sm={2}>
                                                                            <IconButton
                                                                                onClick={() => removeButton(component, buttonIndex, index, setFieldValue)}
                                                                            >
                                                                                <DeleteIcon />
                                                                            </IconButton>
                                                                        </Grid>
                                                                    </Grid>

                                                                    {button.type === 'URL' && (
                                                                        <TextField
                                                                            label="URL (Website)"
                                                                            fullWidth
                                                                            style={{ marginTop: 8 }}
                                                                            value={button.url || ''}
                                                                            onChange={(e) => setFieldValue(
                                                                                `components[${index}].buttons[${buttonIndex}].url`,
                                                                                e.target.value
                                                                            )}
                                                                            placeholder="https://www.exemplo.com"
                                                                        />
                                                                    )}

                                                                    {button.type === 'PHONE_NUMBER' && (
                                                                        <TextField
                                                                            label="Número de Telefone"
                                                                            fullWidth
                                                                            style={{ marginTop: 8 }}
                                                                            value={button.phone_number || ''}
                                                                            onChange={(e) => setFieldValue(
                                                                                `components[${index}].buttons[${buttonIndex}].phone_number`,
                                                                                e.target.value
                                                                            )}
                                                                            placeholder="+5511999999999"
                                                                            helperText="Inclua o código do país (ex: +55...)"
                                                                        />
                                                                    )}

                                                                    {button.type === 'COPY_CODE' && (
                                                                        <TextField
                                                                            label="Exemplo de Código (Obrigatório)"
                                                                            fullWidth
                                                                            style={{ marginTop: 8 }}
                                                                            value={button.example?.[0] || ''}
                                                                            onChange={(e) => setFieldValue(
                                                                                `components[${index}].buttons[${buttonIndex}].example`,
                                                                                [e.target.value]
                                                                            )}
                                                                            placeholder="Ex: 123456 (Cupom ou Código de Autenticação)"
                                                                            helperText="Este valor é usado pela Meta para validar o botão de cópia."
                                                                        />
                                                                    )}
                                                                </Box>
                                                            ))}

                                                            <Box display="flex" gap={1}>
                                                                <Button
                                                                    startIcon={<AddIcon />}
                                                                    onClick={() => addButton(component, index, setFieldValue)}
                                                                    variant="outlined"
                                                                >
                                                                    Adicionar Botão
                                                                </Button>

                                                                {values.category === 'MARKETING' && (
                                                                    <Button
                                                                        startIcon={<AddIcon />}
                                                                        onClick={() => addOptOutButton(component, index, setFieldValue)}
                                                                        variant="outlined"
                                                                        color="secondary"
                                                                        title="Adiciona um botão de resposta rápida padrão para Opt-out"
                                                                    >
                                                                        Botão Opt-out
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}

                                        <Button
                                            startIcon={<AddIcon />}
                                            onClick={() => addComponent(push)}
                                            className={classes.addButton}
                                        >
                                            Adicionar Componente
                                        </Button>
                                    </>
                                )}
                            </FieldArray>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={loading}
                            >
                                {loading ? "Salvando..." : "Salvar"}
                            </Button>
                        </DialogActions>
                    </Form>
                )}
            </Formik>
        </Dialog>
    );
};

export default TemplateModal;
