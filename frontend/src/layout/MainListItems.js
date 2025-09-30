import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import { Box } from "@material-ui/core";

// Ícones do Lucide React
import {
  BarChart3,
  PieChart,
  MessageCircle,
  KanbanSquare,
  MessagesSquare,
  HelpCircle,
  ListChecks,
  Bot,
  BotMessageSquare,
  Users,
  CalendarPlus,
  Zap,
  GitMerge,
  TrendingUp,
  Settings,
  ListTodo,
  BookOpen,
  Workflow,
  SmartphoneNfc,
  FolderSymlink,
  UserPlus,
  Landmark,
  FileJson2,
  MonitorCog,
  Monitor,
  Tag,
  ChevronUp,
  ChevronDown,
  LogOut,
  Cpu
} from "lucide-react";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";
import { Can } from "../components/Can";

import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import useVersion from "../hooks/useVersion";
import { i18n } from "../translate/i18n";


import useCompanySettings from "../hooks/useSettings/companySettings";

// Componente wrapper para ícones do Lucide React
const LucideIcon = ({ icon: Icon, size = 24, ...props }) => {
  return <Icon size={size} {...props} />;
};

const useStyles = makeStyles((theme) => ({
  listItem: {
    borderRadius: "6px",
    marginBottom: "6px",
    padding: "6px 15px",
    color: "#ffffff",
    position: "relative",
    "&:hover": {
      backgroundColor: "#202C33",
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "4px",
        backgroundColor: "#21C063",
        borderRadius: "0px"
      },
      "& .MuiListItemIcon-root": {
        transform: "translateX(4px)",
        transition: "transform 0.2s",
        color: "#21C063"
      },
      "& .MuiListItemText-primary": {
         color: "#21C063"
      }
    },
  },

  listItemText: {
    fontSize: "14px",
    color: "#ffffff",
    "& .MuiListItemText-primary": {
      fontSize: "14px",
    fontWeight: 500,
      color: "#ffffff"
    }
  },

  active: {
    backgroundColor: "#202C33",
    "&::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "4px",
      backgroundColor: "#21C063",
      borderRadius: "0px"
    },
    "& .MuiListItemIcon-root": {
      transform: "translateX(4px)",
      color: "#21C063"
    },
    "& .MuiListItemText-primary": {
      color: "#21C063"
    }
  },

  nested: {
    paddingLeft: theme.spacing(3),
    marginBottom: "2px",
    "&:hover": {
      "& .MuiListItemIcon-root": {
        color: "#21C063"
      },
      "& .MuiListItemText-primary": {
        color: "#21C063"
      }
    }
  },

  list: {
    padding: 0,
    margin: 0,
  },

  logoutButton: {
    borderRadius: "6px",
    marginBottom: "6px",
    padding: "6px 15px",
    color: "#ffffff",
    "&:hover": {
      backgroundColor: "#202C33",
    },
  },

  listItemIcon: {
    transition: "all 0.2s",
    minWidth: "45px",
    color: "#ffffff"
  },
  
  listItemIconSmall: {
    minWidth: "35px",
    color: "#ffffff"
  },

  listSubheader: {
    position: "relative",
    fontSize: "17px",
    textAlign: "left",
    paddingLeft: 20,
    color: "inherit",
  },

  mainItemsContainer: {
    flex: 1,
    overflowY: "auto",
    "&::-webkit-scrollbar": {
      width: "4px",
      display: "none"
    },
  },

  expandIcon: {
    color: "#ffffff"
  },

  badge: {
    "& .MuiBadge-badge": {
      backgroundColor: "#ef4444",
      color: "#fff",
      fontSize: "0.75rem",
      fontWeight: 600,
    }
  },
}));

function ListItemLink(props) {
  const { icon, primary, to, tooltip, showBadge, isSubItem, collapsed, small } = props;
  const classes = useStyles();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = activeMenu === to || location.pathname === to;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const ConditionalTooltip = ({ children, tooltipEnabled, tooltipText }) =>
    tooltipEnabled ? (
      <Tooltip title={tooltipText} placement="right">
        {children}
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip} tooltipText={primary}>
      <li>
        <ListItem 
          button 
          dense
          component={renderLink} 
          className={`${classes.listItem} ${isActive ? classes.active : ""} ${isSubItem && !collapsed ? classes.nested : ""}`}
        >
          {icon ? (
            <ListItemIcon className={small ? classes.listItemIconSmall : classes.listItemIcon}>
              {showBadge ? (
                <Badge
                  badgeContent="!"
                  color="error"
                  overlap="circular"
                  className={classes.badge}
                >
                  {icon}
                </Badge>
              ) : (
                icon
              )}
            </ListItemIcon>
          ) : null}
          <ListItemText
            primary={primary}
            className={classes.listItemText}
          />
        </ListItem>
      </li>
    </ConditionalTooltip>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = ({ collapsed, drawerClose }) => {
  const theme = useTheme();
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket, handleLogout } = useContext(AuthContext);

  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(false);
  const [openAdminSubmenu, setOpenAdminSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  // novas features
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const [version, setVersion] = useState(false);
  const [managementHover, setManagementHover] = useState(false);
  const [campaignHover, setCampaignHover] = useState(false);
  const [adminHover, setAdminHover] = useState(false);
  const { list } = useHelps(); // INSERIR
  const [hasHelps, setHasHelps] = useState(false);

  const [openFlowSubmenu, setOpenFlowSubmenu] = useState(false);
  const [flowHover, setFlowHover] = useState(false);

  const { get: getSetting } = useCompanySettings();
  const [showWallets, setShowWallets] = useState(false);

  const isFlowbuilderRouteActive =
    location.pathname.startsWith("/phrase-lists");
  location.pathname.startsWith("/flowbuilders");

  useEffect(() => {
    // INSERIR ESSE EFFECT INTEIRO
    async function checkHelps() {
      const helps = await list();
      setHasHelps(helps.length > 0);
    }
    checkHelps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const setting = await getSetting(
          {
            "column": "DirectTicketsToWallets"
          }
        );

        setShowWallets(setting.DirectTicketsToWallets);

      } catch (err) {
        toastError(err);
      }
    }

    fetchSettings();
  }, [setShowWallets]);

  const isManagementActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/moments");

  const isCampaignRouteActive =
    location.pathname === "/campaigns" ||
    location.pathname.startsWith("/contact-lists") ||
    location.pathname.startsWith("/campaigns-config");

  const isAdminRouteActive =
    location.pathname === "/announcements" ||
    location.pathname.startsWith("/messages-api") ||
    location.pathname === "/users" ||
    location.pathname === "/queues" ||
    location.pathname === "/prompts" ||
    location.pathname === "/queue-integration" ||
    location.pathname === "/connections" ||
    location.pathname === "/allConnections" ||
    location.pathname === "/files" ||
    location.pathname === "/financeiro" ||
    location.pathname === "/settings" ||
    location.pathname === "/companies";

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  const { getPlanCompany } = usePlans();

  const { getVersion } = useVersion();

  useEffect(() => {
    async function fetchVersion() {
      const _version = await getVersion();
      setVersion(_version.version);
    }
    fetchVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowCampaigns(planConfigs.plan.useCampaigns);
      setShowKanban(planConfigs.plan.useKanban);
      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
      setShowSchedules(planConfigs.plan.useSchedules);
      setShowInternalChat(planConfigs.plan.useInternalChat);
      setShowExternalApi(planConfigs.plan.useExternalApi);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

useEffect(() => {
  if (user.id && socket && typeof socket.on === 'function') {
    const companyId = user.companyId;
    
    const onCompanyChatMainListItems = (data) => {
      if (data.action === "new-message") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
      if (data.action === "update") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    };

    const eventName = `company-${companyId}-chat`;
    console.log('Registrando listener para:', eventName);
    
    socket.on(eventName, onCompanyChatMainListItems);
    
    return () => {
      if (socket && typeof socket.off === 'function') {
        console.log('Removendo listener para:', eventName);
        socket.off(eventName, onCompanyChatMainListItems);
      }
    };
  }
}, [socket, user.id, user.companyId]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  // useEffect(() => {
  //   if (localStorage.getItem("cshow")) {
  //     setShowCampaigns(true);
  //   }
  // }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  const handleClickLogout = () => {
    handleLogout();
  };

  return (
    <Box
      onClick={drawerClose}
      display="flex"
      flexDirection="column"
      height="100%"
      sx={{
        padding: "8px",
      }}
    >
      {/* Container principal (flex: 1) - Aplicado o overflow aqui */}
      <Box className={classes.mainItemsContainer}>
      <Can
        role={
          (user.profile === "user" && user.showDashboard === "enabled") ||
            user.allowRealTime === "enabled"
            ? "admin"
            : user.profile
        }
        perform={"drawer-admin-items:view"}
        yes={() => (
          <>
            <Tooltip
              title={collapsed ? i18n.t("mainDrawer.listItems.management") : ""}
              placement="right"
            >
              <ListItem
                dense
                button
                onClick={() => setOpenDashboardSubmenu((prev) => !prev)}
                onMouseEnter={() => setManagementHover(true)}
                onMouseLeave={() => setManagementHover(false)}
                className={`${classes.listItem} ${isManagementActive || managementHover ? classes.active : ""}`}
              >
                <ListItemIcon className={classes.listItemIcon}>
                  <LucideIcon icon={Landmark} />
                </ListItemIcon>
                <ListItemText
                  primary={i18n.t("mainDrawer.listItems.management")}
                  className={classes.listItemText}
                />
                {openDashboardSubmenu ? <LucideIcon icon={ChevronUp} className={classes.expandIcon} /> : <LucideIcon icon={ChevronDown} className={classes.expandIcon} />}
              </ListItem>
            </Tooltip>
            <Collapse
              in={openDashboardSubmenu}
              timeout="auto"
              unmountOnExit
              style={{
                backgroundColor:
                  theme.mode === "light"
                    ? "rgba(120,120,120,0.1)"
                    : "rgba(120,120,120,0.5)",
              }}
            >
              <Can
                role={
                  user.profile === "user" && user.showDashboard === "enabled"
                    ? "admin"
                    : user.profile
                }
                perform={"drawer-admin-items:view"}
                yes={() => (
                  <>
                    <ListItemLink
                      small
                      to="/"
                      primary="Dashboard"
                      icon={<LucideIcon icon={BarChart3} />}
                      tooltip={collapsed}
                    />
                    <ListItemLink
                      small
                      to="/reports"
                      primary={i18n.t("mainDrawer.listItems.reports")}
                      icon={<LucideIcon icon={PieChart} />}
                      tooltip={collapsed}
                    />
                  </>
                )}
              />
              <Can
                role={
                  user.profile === "user" && user.allowRealTime === "enabled"
                    ? "admin"
                    : user.profile
                }
                perform={"drawer-admin-items:view"}
                yes={() => (
                  <ListItemLink
                    to="/moments"
                    primary={i18n.t("mainDrawer.listItems.chatsTempoReal")}
                    icon={<LucideIcon icon={Monitor} />}
                    tooltip={collapsed}
                  />
                )}
              />
              {user.profile === "admin" && showWallets && (
                <>
                  <ListItemLink
                    to="/wallets"
                    primary={i18n.t("mainDrawer.listItems.wallets")}
                    icon={<LucideIcon icon={BookOpen} />}
                    tooltip={collapsed}
                  />
                </>
              )}
            </Collapse>
          </>
        )}
      />
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<LucideIcon icon={MessageCircle} />}
        tooltip={collapsed}
      />

      <ListItemLink
        to="/quick-messages"
        primary={i18n.t("mainDrawer.listItems.quickMessages")}
        icon={<LucideIcon icon={Zap} />}
        tooltip={collapsed}
      />

      {showKanban && (
        <>
          <ListItemLink
            to="/kanban"
            primary={i18n.t("mainDrawer.listItems.kanban")}
            icon={<LucideIcon icon={KanbanSquare} />}
            tooltip={collapsed}
          />
        </>
      )}

      {user.showContacts === "enabled" && (
        <ListItemLink
          to="/contacts"
          primary={i18n.t("mainDrawer.listItems.contacts")}
          icon={<LucideIcon icon={Users} />}
          tooltip={collapsed}
        />
      )}

      {showSchedules && (
        <>
          <ListItemLink
            to="/schedules"
            primary={i18n.t("mainDrawer.listItems.schedules")}
            icon={<LucideIcon icon={CalendarPlus} />}
            tooltip={collapsed}
          />
        </>
      )}

      <ListItemLink
        to="/tags"
        primary={i18n.t("mainDrawer.listItems.tags")}
        icon={<LucideIcon icon={Tag} />}
        tooltip={collapsed}
      />

      {showInternalChat && (
        <>
          <ListItemLink
            to="/chats"
            primary={i18n.t("mainDrawer.listItems.chats")}
            icon={
              <Badge color="secondary" variant="dot" invisible={invisible}>
                <LucideIcon icon={MessagesSquare} />
              </Badge>
            }
            tooltip={collapsed}
          />
        </>
      )}

      {/* 
      <ListItemLink
        to="/todolist"
        primary={i18n.t("ToDoList")}
        icon={<EventAvailableIcon />}
      /> 
      */}

      {hasHelps && (
        <ListItemLink
          to="/helps"
          primary={i18n.t("mainDrawer.listItems.helps")}
          icon={<LucideIcon icon={HelpCircle} />}
          tooltip={collapsed}
        />
      )}

      {user?.showCampaign === "enabled" && showCampaigns && (
        <>
          <Tooltip
            title={collapsed ? i18n.t("mainDrawer.listItems.campaigns") : ""}
            placement="right"
          >
            <ListItem
              dense
              button
              onClick={() => setOpenCampaignSubmenu((prev) => !prev)}
              onMouseEnter={() => setCampaignHover(true)}
              onMouseLeave={() => setCampaignHover(false)}
              className={`${classes.listItem} ${isCampaignRouteActive || campaignHover ? classes.active : ""}`}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <LucideIcon icon={TrendingUp} />
              </ListItemIcon>
              <ListItemText
                primary={i18n.t("mainDrawer.listItems.campaigns")}
                className={classes.listItemText}
              />
              {openCampaignSubmenu ? <LucideIcon icon={ChevronUp} className={classes.expandIcon} /> : <LucideIcon icon={ChevronDown} className={classes.expandIcon} />}
            </ListItem>
          </Tooltip>
          <Collapse
            in={openCampaignSubmenu}
            timeout="auto"
            unmountOnExit
            style={{
              backgroundColor:
                theme.mode === "light"
                  ? "rgba(120,120,120,0.1)"
                  : "rgba(120,120,120,0.5)",
            }}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/campaigns"
                primary={i18n.t("campaigns.subMenus.list")}
                icon={<LucideIcon icon={TrendingUp} />}
                tooltip={collapsed}
              />
              <ListItemLink
                to="/contact-lists"
                primary={i18n.t("campaigns.subMenus.listContacts")}
                icon={<LucideIcon icon={ListTodo} />}
                tooltip={collapsed}
              />
              <ListItemLink
                to="/campaigns-config"
                primary={i18n.t("campaigns.subMenus.settings")}
                icon={<LucideIcon icon={Settings} />}
                tooltip={collapsed}
              />
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <ListItemLink
                    to="/files"
                    primary={i18n.t("mainDrawer.listItems.files")}
                    icon={<LucideIcon icon={FolderSymlink} />}
                    tooltip={collapsed}
                  />
                )}
              />
            </List>
          </Collapse>
        </>
      )}

      {/* FLOWBUILDER */}
      {user.showFlow === "enabled" && (
        <>
          <Tooltip
            title={
              collapsed ? i18n.t("mainDrawer.listItems.campaigns") : ""
            }
            placement="right"
          >
            <ListItem
              dense
              button
              onClick={() => setOpenFlowSubmenu((prev) => !prev)}
              onMouseEnter={() => setFlowHover(true)}
              onMouseLeave={() => setFlowHover(false)}
              className={`${classes.listItem} ${isFlowbuilderRouteActive || flowHover ? classes.active : ""}`}
            >
              <ListItemIcon className={classes.listItemIcon}>
                <LucideIcon icon={Workflow} />
              </ListItemIcon>
              <ListItemText
                primary={i18n.t("Flowbuilder")}
                className={classes.listItemText}
              />
              {openFlowSubmenu ? (
                <LucideIcon icon={ChevronUp} className={classes.expandIcon} />
              ) : (
                <LucideIcon icon={ChevronDown} className={classes.expandIcon} />
              )}
            </ListItem>
          </Tooltip>

          <Collapse
            in={openFlowSubmenu}
            timeout="auto"
            unmountOnExit
            style={{
              backgroundColor:
                theme.mode === "light"
                  ? "rgba(120,120,120,0.1)"
                  : "rgba(120,120,120,0.5)",
            }}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/phrase-lists"
                primary={"Fluxo de Campanha"}
                icon={<LucideIcon icon={CalendarPlus} />}
                tooltip={collapsed}
              />

              <ListItemLink
                to="/flowbuilders"
                primary={"Fluxo de conversa"}
                icon={<LucideIcon icon={Workflow} />}
              />
            </List>
          </Collapse>
        </>
      )}

      <Can
        role={
          user.profile === "user" && user.allowConnections === "enabled"
            ? "admin"
            : user.profile
        }
        perform="dashboard:view"
        yes={() => (
          <>
            <Tooltip
              title={collapsed ? i18n.t("mainDrawer.listItems.administration") : ""}
              placement="right"
            >
              <ListItem
                dense
                button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenAdminSubmenu((prev) => !prev);
                }}
                onMouseEnter={() => setAdminHover(true)}
                onMouseLeave={() => setAdminHover(false)}
                className={`${classes.listItem} ${isAdminRouteActive || adminHover ? classes.active : ""}`}
              >
                <ListItemIcon className={classes.listItemIcon}>
                  <LucideIcon icon={MonitorCog} />
                </ListItemIcon>
                <ListItemText
                  primary={i18n.t("mainDrawer.listItems.administration")}
                  className={classes.listItemText}
                />
                {openAdminSubmenu ? <LucideIcon icon={ChevronUp} className={classes.expandIcon} /> : <LucideIcon icon={ChevronDown} className={classes.expandIcon} />}
              </ListItem>
            </Tooltip>
            <Collapse
              in={openAdminSubmenu}
              timeout="auto"
              unmountOnExit
              style={{
                backgroundColor:
                  theme.mode === "light"
                    ? "rgba(120,120,120,0.1)"
                    : "rgba(120,120,120,0.5)",
              }}
            >
              <List dense component="div" disablePadding>
            {user.super && (
              <ListItemLink
                to="/announcements"
                primary={i18n.t("mainDrawer.listItems.annoucements")}
                icon={<LucideIcon icon={BookOpen} />}
                tooltip={collapsed}
                isSubItem={true}
                collapsed={collapsed}
              />
            )}

            {showExternalApi && (
              <>
                <Can
                  role={user.profile}
                  perform="dashboard:view"
                  yes={() => (
                    <ListItemLink
                      to="/messages-api"
                      primary={i18n.t("mainDrawer.listItems.messagesAPI")}
                      icon={<LucideIcon icon={FileJson2} />}
                      tooltip={collapsed}
                      isSubItem={true}
                      collapsed={collapsed}
                    />
                  )}
                />
              </>
            )}

            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/users"
                  primary={i18n.t("mainDrawer.listItems.users")}
                  icon={<LucideIcon icon={UserPlus} />}
                  tooltip={collapsed}
                  isSubItem={true}
                  collapsed={collapsed}
                />
              )}
            />

            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/queues"
                  primary={i18n.t("mainDrawer.listItems.queues")}
                  icon={<LucideIcon icon={GitMerge} />}
                  tooltip={collapsed}
                  isSubItem={true}
                  collapsed={collapsed}
                />
              )}
            />

            {showOpenAi && (
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <ListItemLink
                    to="/prompts"
                    primary={i18n.t("mainDrawer.listItems.prompts")}
                    icon={<LucideIcon icon={Bot} />}
                    tooltip={collapsed}
                    isSubItem={true}
                    collapsed={collapsed}
                  />
                )}
              />
            )}

            {showIntegrations && (
              <Can
                role={user.profile}
                perform="dashboard:view"
                yes={() => (
                  <ListItemLink
                    to="/queue-integration"
                    primary={i18n.t("mainDrawer.listItems.queueIntegration")}
                    icon={<LucideIcon icon={MonitorCog} />}
                    tooltip={collapsed}
                    isSubItem={true}
                    collapsed={collapsed}
                  />
                )}
              />
            )}
            <Can
              role={
                user.profile === "user" && user.allowConnections === "enabled"
                  ? "admin"
                  : user.profile
              }
              perform={"drawer-admin-items:view"}
              yes={() => (
                <ListItemLink
                  to="/connections"
                  primary={i18n.t("mainDrawer.listItems.connections")}
                  icon={<LucideIcon icon={SmartphoneNfc} />}
                  showBadge={connectionWarning}
                  tooltip={collapsed}
                  isSubItem={true}
                  collapsed={collapsed}
                />
              )}
            />
            {user.super && (
              <ListItemLink
                to="/allConnections"
                primary={i18n.t("mainDrawer.listItems.allConnections")}
                icon={<LucideIcon icon={SmartphoneNfc} />}
                tooltip={collapsed}
                isSubItem={true}
                collapsed={collapsed}
              />
            )}
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/financeiro"
                  primary={i18n.t("mainDrawer.listItems.financeiro")}
                  icon={<LucideIcon icon={BarChart3} />}
                  tooltip={collapsed}
                  isSubItem={true}
                  collapsed={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/settings"
                  primary={i18n.t("mainDrawer.listItems.settings")}
                  icon={<LucideIcon icon={Settings} />}
                  tooltip={collapsed}
                  isSubItem={true}
                  collapsed={collapsed}
                />
              )}
            />
            {user.super && (
              <ListItemLink
                to="/companies"
                primary={i18n.t("mainDrawer.listItems.companies")}
                icon={<LucideIcon icon={Landmark} />}
                tooltip={collapsed}
                isSubItem={true}
                collapsed={collapsed}
              />
            )}
              </List>
            </Collapse>
          </>
        )}
      />
      </Box>

      {/* Divider para separar a parte de cima do rodapé */}
      <Divider style={{ margin: "4px 0" }} />

      {/* Rodapé: Versão e Sair */}
      <Box>
        <ListItem
          button
          dense
          style={{ marginBottom: "6px" }}
        >
          <ListItemIcon className={classes.listItemIcon}> 
            <LucideIcon icon={Cpu} />
          </ListItemIcon>
          {!collapsed && (
            <ListItemText primary={`Versão ${version ? `${version}` : ""}`} className={classes.listItemText} /> 
          )}
        </ListItem>

        <ListItem
          button
          dense
          onClick={handleClickLogout}
          className={classes.logoutButton}
        >
          <ListItemIcon className={classes.listItemIcon}> 
            <LucideIcon icon={LogOut} />
          </ListItemIcon>
          {!collapsed && (
            <ListItemText primary={i18n.t("Sair")} className={classes.listItemText} /> 
          )}
        </ListItem>
      </Box>
    </Box>
  );
};

export default MainListItems;