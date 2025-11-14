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
    Divider,
    Grid,
    Card,
    CardContent,
    FormHelperText,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from "@material-ui/core";
import {
    Close as CloseIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { Formik, Form, Field, FieldArray } from "formik";
import * as Yup from "yup";
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
    }
}));

const templateSchema = Yup.object().shape({
    name: Yup.string().required("Nome é obrigatório"),
    category: Yup.string().required("Categoria é obrigatória"),
    language: Yup.string().required("Idioma é obrigatório"),
    components: Yup.array().min(1, "Pelo menos um componente é necessário")
});

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
    { value: 'PHONE_NUMBER', label: 'Telefone' }
];

const TemplateModal = ({ open, onClose, templateId, whatsappId, onSave }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [initialValues, setInitialValues] = useState({
        name: "",
        category: "",
        language: "pt_BR",
        parameter_format: "positional",
        components: [
            {
                type: "BODY",
                text: "",
                example: { body_text: [] }
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
                        text: "",
                        example: { body_text: [] }
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
            setLoading(true);
            
            if (templateId) {
                await api.put(`/templates/${whatsappId}/${templateId}`, values);
                toast.success("Template atualizado com sucesso!");
            } else {
                await api.post(`/templates/${whatsappId}`, values);
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
            text: "",
            example: { body_text: [] }
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

    const removeButton = (component, buttonIndex, index, setFieldValue) => {
        const buttons = [...(component.buttons || [])];
        buttons.splice(buttonIndex, 1);
        setFieldValue(`components[${index}].buttons`, buttons);
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
                validationSchema={templateSchema}
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ values, errors, touched, setFieldValue }) => (
                    <Form>
                        <DialogContent dividers>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Field name="name">
                                        {({ field }) => (
                                            <TextField
                                                {...field}
                                                label="Nome do Template"
                                                fullWidth
                                                error={touched.name && !!errors.name}
                                                helperText={touched.name && errors.name}
                                                disabled={!!templateId}
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

                                                    <Field name={`components[${index}].text`}>
                                                        {({ field }) => (
                                                            <TextField
                                                                {...field}
                                                                label="Texto"
                                                                fullWidth
                                                                multiline
                                                                rows={3}
                                                                helperText={`Use {1}, {2} para parâmetros posicionais ou {nome}, {data} para nomeados`}
                                                                style={{ marginTop: 16 }}
                                                            />
                                                        )}
                                                    </Field>

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
                                                                                label="Texto"
                                                                                fullWidth
                                                                                value={button.text}
                                                                                onChange={(e) => setFieldValue(
                                                                                    `components[${index}].buttons[${buttonIndex}].text`,
                                                                                    e.target.value
                                                                                )}
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
                                                                            label="URL"
                                                                            fullWidth
                                                                            style={{ marginTop: 8 }}
                                                                            value={button.url || ''}
                                                                            onChange={(e) => setFieldValue(
                                                                                `components[${index}].buttons[${buttonIndex}].url`,
                                                                                e.target.value
                                                                            )}
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
                                                                        />
                                                                    )}
                                                                </Box>
                                                            ))}
                                                            
                                                            <Button
                                                                startIcon={<AddIcon />}
                                                                onClick={() => addButton(component, index, setFieldValue)}
                                                            >
                                                                Adicionar Botão
                                                            </Button>
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
