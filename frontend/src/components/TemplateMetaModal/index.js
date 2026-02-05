import React, { useState, useEffect } from 'react';
import {
    Modal,
    Box,
    TextField,
    Typography,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Button,
    Chip,
    Grid
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import { makeStyles } from '@material-ui/core/styles';
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    modal: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        width: '80%',
        maxHeight: '80%',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(2),
        borderRadius: theme.shape.borderRadius,
        overflowY: 'auto',
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: theme.spacing(2),
    },
    searchInput: {
        marginLeft: theme.spacing(1),
        flex: 1,
    },
    templateItem: {
        backgroundColor: theme.palette.optionsBackground,
        color: theme.palette.primary,
        padding: theme.spacing(2),
        borderRadius: theme.shape.borderRadius,
        marginBottom: theme.spacing(2),
    },
    templateInfo: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    category: {
        marginTop: theme.spacing(1),
    },
}));

const TemplateModal = ({ open, handleClose, templates, onSelectTemplate, contactId }) => {
    const classes = useStyles();
    const [search, setSearch] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [expandedTemplates, setExpandedTemplates] = useState({}); // Controla quais templates estão expandidos
    const [variables, setVariables] = useState([]);
    const [variableValues, setVariableValues] = useState({});
    const [renderedContent, setRenderedContent] = useState('');
    const [contactName, setContactName] = useState('');

    useEffect(() => {
        if (contactId) {
            api.get(`/contacts/${contactId}`).then(({ data }) => {
                setContactName(data.name);
            }).catch(err => console.error(err));
        }
    }, [contactId]);

    const availableVariables = [
        { name: 'Nome', value: '{{name}}' },
        { name: 'Primeiro Nome', value: '{{firstName}}' },
        { name: 'Saudação', value: '{{ms}}' },
        { name: 'Protocolo', value: '{{protocol}}' },
        { name: 'Hora', value: '{{hour}}' },
        { name: 'Data', value: '{{date}}' },
    ];


    const handleSearchChange = (event) => {
        setSearch(event.target.value);
    };

    const toggleExpand = (templateId) => {
        setExpandedTemplates(prev => ({
            ...prev,
            [templateId]: !prev[templateId]
        }));
    };

    const extractVariablesByComponent = (components) => {
        const regex = /{{([^{}]+)}}/g;
        let variables = {
            header: [],
            body: [],
            footer: [],
            buttons: []
        };

        components.forEach((component) => {
            let match;
            const type = component.type?.toLowerCase();
            const text = component.text || '';

            if (type === 'header' && ['IMAGE', 'VIDEO'].includes(component?.format)) {
                variables[type].push({ type: `${component?.format.toLowerCase()}`, prompt: component?.format.toLowerCase() === 'image' ? 'Insira a URL da imagem' : 'Insira a URL do vídeo' });
            }
            // Para os botões, verifique a URL para variáveis
            if (type === 'buttons') {
                const buttons = JSON.parse(component.buttons)
                buttons.forEach((button, index) => {
                    if (button.example) {
                        console.log("button", button, index)
                        variables[type].push({ type: button.type, prompt: button.example, index: index });
                    }
                    else if (variables[type]) {
                        while ((match = regex.exec(text)) !== null) {
                            variables[type].push(match[0]);
                        }
                    }
                });
            } else if (variables[type]) {
                while ((match = regex.exec(text)) !== null) {
                    variables[type].push({ type: 'text', prompt: match[0], name: match[1] });
                }
            } else {
                console.warn(`Tipo de componente desconhecido: ${type}`);
            }
        });
        return variables;
    };

    const getAutoFillValue = (paramName) => {
        const lowerName = paramName?.toLowerCase() || '';

        // Se tiver contactName (Contexto de Ticket/Atendimento Individual)
        if (contactName) {
            if (lowerName === 'name' || lowerName === 'nome') {
                return contactName;
            }
            if (lowerName === 'firstname' || lowerName === 'primeiro nome') {
                return contactName.split(' ')[0];
            }
            return '';
        }

        // Se NÃO tiver contactName (Contexto de Campanha/Disparo em Massa)
        // Auto-preencher com as variáveis dinâmicas que o backend suporta
        if (lowerName.includes('name') || lowerName.includes('nome')) {
            return '{{name}}';
        }
        if (lowerName.includes('firstname') || lowerName.includes('primeiro nome')) {
            return '{{name}}'; // Fallback seguro para nome completo pois backend ainda não suporta firstname
        }
        if (lowerName.includes('email')) {
            return '{{email}}';
        }
        if (lowerName.includes('numero') || lowerName.includes('number') || lowerName.includes('phone') || lowerName.includes('celular')) {
            return '{{numero}}';
        }
        if (lowerName.includes('date') || lowerName.includes('data')) {
            return '{{data}}'; // Necessita suporte no backend ou é apenas placeholder
        }
        if (lowerName.includes('hour') || lowerName.includes('hora')) {
            return '{{hora}}'; // Necessita suporte no backend ou é apenas placeholder
        }

        return '';
    };

    const handleSelectTemplate = (template) => {
        const components = template?.components || [];
        const extractedVariables = extractVariablesByComponent(components);

        // Log para debug da estrutura do template
        console.log("Template selecionado no modal:", {
            id: template.id,
            name: template.name,
            shortcode: template.shortcode,
            language: template.language,
            components: template.components?.length
        });

        setSelectedTemplate(template);
        setVariables(extractedVariables);
        setRenderedContent(components.map((component) => component?.text).join(`\n`));

        // ✅ INICIALIZAR variableValues para garantir que nada vá vazio/undefined
        // E verificar auto-preenchimento
        const initialValues = {};
        Object.keys(extractedVariables).forEach((key) => {
            if (extractedVariables[key].length > 0) {
                initialValues[key] = {};
                extractedVariables[key].forEach((variable, index) => {
                    const autoFill = getAutoFillValue(variable.name);
                    initialValues[key][index] = {
                        value: autoFill || '',
                        name: variable.name || '' // Garante que o nome seja passado
                    };
                });
            }
        });
        setVariableValues(initialValues);
    };

    const generateBodyToSave = (content, variables) => {
        let bodyToSave = content;
        Object.keys(variables).forEach((componentType) => {
            const componentVariables = variables[componentType];

            if (Array.isArray(componentVariables)) {
                console.log("componentVariables ARRAY", componentVariables)
                // Se for um array, iteramos sobre ele substituindo as variáveis
                componentVariables.forEach((variable, index) => {
                    const placeholder = `{{${index + 1}}}`;
                    const value = variable?.value || '';
                    bodyToSave = bodyToSave.replace(placeholder, value);
                });
            } else if (typeof componentVariables === 'object') {
                console.log("componentVariables OBJECT", componentVariables)
                // Se for um objeto (caso do header com uma imagem ou outro tipo de conteúdo)
                if (componentType === 'header') {
                    console.log("componentVariables", componentVariables)
                    // Substituir um placeholder específico no header por uma URL de imagem
                    Object.keys(componentVariables).forEach((key, index) => {
                        const value = componentVariables[key]?.value || '';
                        console.log("value", value, value.startsWith("http"))
                        if (value.startsWith("http")) {
                            bodyToSave = `${value} \n ${bodyToSave}`
                            console.log("bodyToSave", bodyToSave)
                        } else {
                            const placeholder = `{{${index + 1}}}`;

                            bodyToSave = bodyToSave.replace(placeholder, value);
                        }
                    });
                } else {
                    // Para texto ou outros tipos de componentes, substituímos as variáveis como antes
                    Object.keys(componentVariables).forEach((key, index) => {
                        const placeholder = `{{${index + 1}}}`;
                        const value = componentVariables[key]?.value || '';
                        bodyToSave = bodyToSave.replace(placeholder, value);
                    });
                }
            } else {
                console.error(`Expected array or object for componentType: ${componentType}, but got`, componentVariables);
            }
        });

        console.log("bodyToSave", bodyToSave);
        return bodyToSave;
    };

    const handleSendTemplate = () => {
        const bodyToSave = generateBodyToSave(renderedContent, variableValues);
        const templateWithVariables = {
            ...selectedTemplate,
            variables: variableValues,
            bodyToSave
        };

        // Log antes de enviar para o componente pai
        console.log("Enviando template para o componente pai:", {
            id: templateWithVariables.id,
            name: templateWithVariables.name,
            shortcode: templateWithVariables.shortcode,
            language: templateWithVariables.language
        });

        onSelectTemplate(templateWithVariables);
    };

    const handleVariableChange = (componentType, index, value, buttonIndex, paramName) => {
        // Atualiza o estado das variáveis por tipo de componente
        const newComponentValues = { ...variableValues[componentType], [index]: { value, buttonIndex, name: paramName } };
        const newValues = { ...variableValues, [componentType]: newComponentValues };
        setVariableValues(newValues);
    };

    const handleAddVariable = (componentType, index, variableValue, buttonIndex, paramName) => {
        const currentValue = variableValues[componentType]?.[index]?.value || '';
        const newValue = currentValue + variableValue;
        handleVariableChange(componentType, index, newValue, buttonIndex, paramName);
    };

    const filteredTemplates = templates.filter((template) => {
        // ✅ CORREÇÃO: Templates Meta usam 'name', não 'shortcode'
        const searchField = template?.name || template?.shortcode || '';
        const searchTerm = search?.toLowerCase() || '';
        return searchField.toLowerCase().includes(searchTerm);
    })

    // Validação para desabilitar botão
    const isSendDisabled = () => {
        // Loop por todos os tipos de componentes em variableValues
        for (const componentType in variableValues) {
            const componentVars = variableValues[componentType];
            // componentVars é um objeto onde keys são índices '0', '1', etc.
            for (const index in componentVars) {
                const variable = componentVars[index];
                if (!variable.value || variable.value.trim() === '') {
                    return true; // Encontrou variável vazia
                }
            }
        }
        return false; // Todas preenchidas
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            className={classes.modal}
            maxWidth="md"
            aria-labelledby="template-modal-title"
        >
            <Box className={classes.modalContent}>
                <Typography variant="h6" id="template-modal-title">
                    Templates do WhatsApp
                </Typography>
                {!selectedTemplate && (
                    <>
                        <div className={classes.searchContainer}>
                            <SearchIcon />
                            <TextField
                                variant="outlined"
                                placeholder="Pesquisar Templates"
                                value={search}
                                onChange={handleSearchChange}
                                className={classes.searchInput}
                            />
                        </div>

                        <List>
                            {filteredTemplates.map((template, index) => {
                                const bodyText = template?.components?.find(c => c.type === 'BODY')?.text || 'Sem conteúdo';
                                const isExpanded = expandedTemplates[template.id];
                                const maxPreviewLength = 150;
                                const needsExpand = bodyText.length > maxPreviewLength;
                                const displayText = isExpanded || !needsExpand
                                    ? bodyText
                                    : bodyText.substring(0, maxPreviewLength) + '...';

                                return (
                                    <ListItem
                                        key={template.id || index}
                                        className={classes.templateItem}
                                        style={{ display: 'block', cursor: 'default' }}
                                    >
                                        <ListItemText
                                            primary={
                                                <div className={classes.templateInfo}>
                                                    <Typography variant="body1" style={{ fontWeight: 'bold' }}>
                                                        {template.name || template.shortcode}
                                                    </Typography>
                                                    <Typography variant="body2" color="textSecondary">
                                                        Idioma: {template.language}
                                                    </Typography>
                                                </div>
                                            }
                                            secondary={
                                                <>
                                                    <Typography
                                                        variant="body2"
                                                        component="div"
                                                        style={{
                                                            whiteSpace: 'pre-wrap',
                                                            marginTop: '8px',
                                                            marginBottom: '8px'
                                                        }}
                                                    >
                                                        {displayText}
                                                    </Typography>
                                                    {needsExpand && (
                                                        <Button
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpand(template.id);
                                                            }}
                                                            style={{
                                                                marginBottom: '8px',
                                                                textTransform: 'none'
                                                            }}
                                                        >
                                                            {isExpanded ? '▲ Ver menos' : '▼ Ver mais'}
                                                        </Button>
                                                    )}
                                                    <Typography variant="body2" className={classes.category}>
                                                        Categoria: {template.category} | Status: {template.status}
                                                    </Typography>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="small"
                                                        onClick={() => handleSelectTemplate(template)}
                                                        style={{ marginTop: '8px' }}
                                                    >
                                                        Selecionar Template
                                                    </Button>
                                                </>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    </>
                )}
                {selectedTemplate && (
                    <Box mt={2}>
                        <Typography variant="h6">Detalhes do Template Selecionado</Typography>
                        <Typography variant="body1">Nome: {selectedTemplate.name}</Typography>
                        <Typography variant="body2">Conteúdo: {renderedContent}</Typography>
                        <Typography variant="body2">Idioma: {selectedTemplate.language}</Typography>
                        <Typography variant="body2">Categoria: {selectedTemplate.category}</Typography>
                        {/* Renderização dos campos para preencher as variáveis */}
                        {Object.keys(variables).map((componentType, index) => (
                            <div key={`${componentType}-${index}`}>
                                {variables[componentType].length > 0 && (
                                    <>
                                        <Typography variant="h6">{componentType.toUpperCase()}</Typography>
                                        {variables[componentType].map((variable, index) => (
                                            <div key={`${componentType}-${index}`}>
                                                <TextField
                                                    label={`${variable?.prompt}`}
                                                    value={variableValues[componentType]?.[index]?.value || ''}
                                                    onChange={(e) => handleVariableChange(componentType, index, e.target.value, variable?.index || 0, variable?.name)}
                                                    fullWidth
                                                    margin="normal"
                                                    error={!variableValues[componentType]?.[index]?.value}
                                                    helperText={!variableValues[componentType]?.[index]?.value ? "Campo obrigatório" : ""}
                                                />
                                                <Grid container spacing={1} style={{ marginBottom: 16 }}>
                                                    {availableVariables.map((availVar) => (
                                                        <Grid item key={availVar.value}>
                                                            <Chip
                                                                label={availVar.name}
                                                                size="small"
                                                                color="primary"
                                                                variant="outlined"
                                                                onClick={() => handleAddVariable(componentType, index, availVar.value, variable?.index || 0, variable?.name)}
                                                                clickable
                                                            />
                                                        </Grid>
                                                    ))}
                                                </Grid>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ))}
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSendTemplate}
                            fullWidth
                            style={{ marginTop: 16 }}
                            disabled={isSendDisabled()}
                        >
                            Enviar
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setSelectedTemplate(null);
                                setVariableValues({});
                                setRenderedContent('');
                            }}
                            fullWidth
                            style={{ marginTop: 8 }}
                        >
                            Voltar
                        </Button>
                    </Box>
                )}
            </Box>
        </Modal>
    );
};

export default TemplateModal;
