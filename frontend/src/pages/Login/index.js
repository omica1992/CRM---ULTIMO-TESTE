import React, { useState, useContext, useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";
import useSettings from "../../hooks/useSettings";
import IconButton from "@material-ui/core/IconButton";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import EmailIcon from "@material-ui/icons/Email";
import LockIcon from "@material-ui/icons/Lock";
import InputAdornment from "@material-ui/core/InputAdornment";
import { Helmet } from "react-helmet";
import BRFlag from "../../assets/brazil.png";
import USFlag from "../../assets/unitedstates.png";
import ESFlag from "../../assets/esspain.png";
import ARFlag from "../../assets/arabe.png";
import clsx from "clsx";
import { getBackendUrl } from "../../config";
import defaultLogoLight from "../../assets/logo.png";

const languageOptions = [
  { value: "pt-BR", label: "Português", icon: BRFlag },
  { value: "en", label: "English", icon: USFlag },
  { value: "es", label: "Spanish", icon: ESFlag },
  { value: "ar", label: "عربي", icon: ARFlag },
];



const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '100vh',
    display: 'flex',
    background: '#E9EBF0',
    overflow: 'hidden',
  },
  leftContainer: {
    width: "70%",
    background: `url(/logotipos/banner-login.png)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    margin: "32px 0 32px 32px",
    borderRadius: "16px 0 0 16px",
    [theme.breakpoints.down('sm')]: {
      display: "none",
    },
  },
  rightContainer: {
    width: "30%",
    background: '#FFF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    margin: "32px 32px 32px 0",
    borderRadius: "0 16px 16px 0",
    [theme.breakpoints.down('sm')]: {
      width: "100%",
      margin: "32px",
      borderRadius: "16px",
    },
  },
  loginContainer: {
    width: '100%',
    maxWidth: 480,
    position: 'relative',
    padding: theme.spacing(0, 2),
  },
  loginCard: {
    padding: theme.spacing(6, 4, 4),
    background: 'transparent',
    boxShadow: 'none',
  },
  logoWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
    '& img': {
      width: 170,
      height: 'auto',
    }
  },
  formTitle: {
    fontSize: '24px',
    fontWeight: 500,
    color: '#1a1a1a',
    marginBottom: theme.spacing(1),
  },
  formSubtitle: {
    color: '#666',
    fontSize: '14px',
    marginBottom: theme.spacing(4),
  },
  inputIcon: {
    color: '#98A2B3',
    opacity: 0.8,
    fontSize: 20,
    marginRight: theme.spacing(1),
  },
  inputField: {
    marginBottom: theme.spacing(2),
    '& .MuiOutlinedInput-root': {
      borderRadius: 8,
      height: 48,
      backgroundColor: '#F4F5F8',
      '& .MuiInputAdornment-root': {
        marginLeft: theme.spacing(1.5),
      },
      '& fieldset': {
        borderColor: 'transparent',
        borderWidth: 1,
      },
      '&:hover fieldset': {
        borderColor: '#E6E6E6',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
      },
      '&.Mui-focused .MuiInputAdornment-root .MuiSvgIcon-root': {
        color: theme.palette.primary.main,
      },
      '& input': {
        fontSize: '14px',
        padding: '12px 16px 12px 12px',
      },
    },
  },
  inputLabel: {
    color: '#666',
    fontSize: '14px',
    transform: 'translate(44px, 14px) scale(1)',
    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },
    '&.MuiInputLabel-shrink': {
      transform: 'translate(14px, -6px) scale(0.75)',
    },
  },
  submitButton: {
    margin: theme.spacing(3, 0, 2),
    padding: '10px',
    height: 44,
    borderRadius: 8,
    fontWeight: 500,
    fontSize: '14px',
    textTransform: 'none',
    backgroundColor: theme.palette.primary.main,
    opacity: 1,
    transition: 'all 0.3s ease',
    '&:disabled': {
      backgroundColor: '#EFF1F5',
      color: '#98A2B3',
      opacity: 1,
    },
    '&:enabled': {
      backgroundColor: theme.palette.primary.main,
      color: '#fff',
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
        opacity: 0.9,
      },
    }
  },
  linkText: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    '&:hover': {
      textDecoration: 'none',
      opacity: 0.8,
    },
  },
  form: {
    width: "100%",
    marginTop: theme.spacing(1),
  },
}));

const Login = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const { appLogoFavicon, appName, mode, appLogoLight } = colorMode;
  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { getPublicSetting } = useSettings();
  const { handleLogin } = useContext(AuthContext);

  const [open, setOpen] = useState(false);
  const ref = useRef();
  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);

  const getCompanyIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get("companyId");
    return companyId ? parseInt(companyId) : null;
  };

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin({ ...user, remember: rememberMe });
  };

  useEffect(() => {
    // Carrega as credenciais salvas se existirem
    const rememberedUser = localStorage.getItem("rememberedUser");
    if (rememberedUser) {
      const savedUser = JSON.parse(rememberedUser);
      setUser(savedUser);
      setRememberMe(true);
    }

    const companyId = getCompanyIdFromUrl();

    getPublicSetting("userCreation", companyId)
      .then((data) => {
        setAllowSignup(data === "enabled");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("enabledLanguages", companyId)
      .then((langs) => {
        let arr = ["pt-BR", "en"];
        try {
          if (langs) arr = JSON.parse(langs);
        } catch {}
        setEnabledLanguages(arr);
      })
      .catch(() => {
        setEnabledLanguages(["pt-BR", "en"]);
      });
  }, []);

  const current =
    languageOptions.find((opt) => opt.value === i18n.language) ||
    languageOptions[0];

  const handleSelect = (opt) => {
    i18n.changeLanguage(opt.value);
    localStorage.setItem("language", opt.value);
    setOpen(false);
    window.location.reload();
  };

  const logo = appLogoLight || defaultLogoLight;
  const randomValue = Math.random();
  const logoWithRandom = `${logo}?r=${randomValue}`;

  return (
    <>
      <Helmet>
        <title>{appName || "Multi100"}</title>
        <link rel="icon" href={appLogoFavicon || "/default-favicon.ico"} />
      </Helmet>
      <div className={classes.root}>
        <div className={classes.leftContainer} />
        <div className={classes.rightContainer}>
          <div className={classes.loginContainer}>
            <div className={classes.logoWrapper}>
              <img 
                src={logoWithRandom} 
                alt="Logo" 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/logo.png';
                }}
              />
            </div>
            
            <div className={classes.loginCard}>
              <div className={classes.formTitle}>
                Oi, vamos começar! 👋
              </div>
              <div className={classes.formSubtitle}>
                Bem-vindo ao sistema, faça login para continuar.
              </div>

              <form className={classes.form} onSubmit={handleSubmit}>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  id="email"
                  label="Endereço de e-mail"
                  name="email"
                  value={user.email}
                  onChange={handleChangeInput}
                  className={classes.inputField}
                  placeholder="seu@email.com"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon className={classes.inputIcon} />
                      </InputAdornment>
                    ),
                  }}
                  InputLabelProps={{
                    className: classes.inputLabel
                  }}
                />

                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="password"
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={user.password}
                  onChange={handleChangeInput}
                  className={classes.inputField}
                  placeholder="Sua senha"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon className={classes.inputIcon} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          onClick={togglePasswordVisibility} 
                          edge="end"
                          style={{ color: '#98A2B3' }}
                        >
                          {showPassword ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  InputLabelProps={{
                    className: classes.inputLabel
                  }}
                />

                <Grid container spacing={2} alignItems="center" style={{ marginTop: '8px', marginBottom: '16px' }}>
                  <Grid item xs>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          color="primary"
                          size="small"
                        />
                      }
                      label={i18n.t("login.form.rememberMe", "Lembrar-me")}
                      style={{ fontSize: '14px' }}
                    />
                  </Grid>
                  <Grid item>
                    <Link
                      component={RouterLink}
                      to="/forgetpsw"
                      className={classes.linkText}
                    >
                      {i18n.t("login.form.forgotPassword", "Esqueceu a senha?")}
                    </Link>
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submitButton}
                >
                  {i18n.t("login.buttons.submit")}
                </Button>

                {allowSignup && (
                  <Grid container>
                    <Grid item>
                      <Link
                        href="#"
                        variant="body2"
                        component={RouterLink}
                        to="/signup"
                      >
                        {i18n.t("login.buttons.register")}
                      </Link>
                    </Grid>
                  </Grid>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Language Selector */}
        <div
          ref={ref}
          style={{
            position: "fixed",
            top: "10px",
            left: "10px",
            backgroundColor: "#ffffffcc",
            padding: "8px 12px",
            borderRadius: "8px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              fontSize: "1rem",
              cursor: "pointer",
              color: "#333",
              outline: "none",
            }}
          >
            <img
              src={current.icon}
              alt={current.label}
              style={{ width: 20, marginRight: 8 }}
            />
            {current.label}
            <span style={{ marginLeft: 8 }}>▾</span>
          </button>

          {open && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                margin: 0,
                padding: 0,
                listStyle: "none",
                background: "#fff",
                border: "1px solid #ccc",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                zIndex: 1000,
                width: "100%",
              }}
            >
              {languageOptions
                .filter((opt) => enabledLanguages.includes(opt.value))
                .map((opt) => (
                  <li
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      background: "white",
                      color: "black",
                    }}
                  >
                    <img
                      src={opt.icon}
                      alt={opt.label}
                      style={{ width: 20, marginRight: 8 }}
                    />
                    {opt.label}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;
