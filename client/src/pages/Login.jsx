import {Link as RouterLink} from "react-router-dom";
import LanguagePicker from "../i18n/LanguagePicker";
import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { companyLogin, pinLogin } from "../features/auth/authApi";
import { useAuth } from "../features/auth/useAuth";
import { defaultRoute } from "../features/plans/access";
export default function Login() {
  const {
    language
  } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const {
    login
  } = useAuth();
  useEffect(() => {
    document.title = t("Sign in") + " · z-Index";
  }, [language]);
  function changeCompany() {
    setChallenge(null);
    setPassword("");
    setPin("");
    setShowSecret(false);
    setError("");
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!challenge && (!email.trim() || !password)) {
      setError(t("Şirkətin e-poçtunu və şifrəsini daxil et."));
      return;
    }
    if (challenge && !/^\d{4,8}$/.test(pin)) {
      setError(t("Şəxsi PIN 4–8 rəqəmdən ibarət olmalıdır."));
      return;
    }
    setLoading(true);
    try {
      if (!challenge) {
        const data = await companyLogin(email.trim(), password);
        if (!data?.loginToken || !data?.company?.name) {
          throw new Error(t("Şirkət məlumatı alınmadı. Yenidən cəhd et."));
        }
        setChallenge(data);
        setPassword("");
        setPin("");
        setShowSecret(false);
      } else {
        const data = await pinLogin(pin, challenge.loginToken);
        if (!data?.token || !data?.user?.company) {
          throw new Error(t("Giriş məlumatı alınmadı. Yenidən cəhd et."));
        }
        login(data.token, data.user);
        navigate(defaultRoute(data.user), {
          replace: true
        });
      }
    } catch (err) {
      if (err?.response?.data?.code === "COMPANY_LOGIN_REQUIRED") {
        setChallenge(null);
        setPin("");
        setShowSecret(false);
      }
      setError(err?.response?.data?.message || (err?.request ? t("Serverlə əlaqə qurulmadı. Yenidən cəhd et.") : err.message) || t("Giriş zamanı xəta baş verdi."));
    } finally {
      setLoading(false);
    }
  }
  const secretLabel = challenge ? "PIN kodunu" : t("Şifrəni");
  const secretAdornment = <InputAdornment position="end">
      <IconButton type="button" size="small" aria-label={secretLabel + (showSecret ? t(" gizlət") : t(" göstər"))} aria-pressed={showSecret} onClick={() => setShowSecret(visible => !visible)} onMouseDown={event => event.preventDefault()} disabled={loading} edge="end" sx={{
      color: "text.secondary"
    }}>
        {showSecret ? <VisibilityOffOutlinedIcon sx={{
        fontSize: 19
      }} /> : <VisibilityOutlinedIcon sx={{
        fontSize: 19
      }} />}
      </IconButton>
    </InputAdornment>;
  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      minHeight: 46,
      borderRadius: "8px",
      bgcolor: "#fff"
    },
    "& .MuiInputBase-input": {
      fontSize: 14,
      py: 1.4
    },
    "& .MuiInputAdornment-root": {
      color: "#8993a6"
    }
  };
  return <Box component="main" sx={{
    minHeight: "100dvh",
    px: 2,
    py: {
      xs: 4,
      sm: 6
    },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    bgcolor: "background.default"
  }}>
      <Box sx={{
      width: "100%",
      maxWidth: 440
    }}>
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.1} sx={{
        mb: 3.5
      }}>
          <Box aria-hidden="true" sx={{
          width: 35,
          height: 35,
          borderRadius: "9px",
          bgcolor: "primary.main",
          display: "grid",
          placeItems: "center",
          fontSize: 23,
          fontWeight: 600,
          color: "#fff"
        }}>
            z
          </Box>
          <Typography sx={{
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: "-0.9px",
          color: "text.primary"
        }}>
            z-Index
          </Typography>
        </Stack>

        <Paper component="section" aria-labelledby="login-heading" elevation={0} sx={{
        p: {
          xs: 2.5,
          sm: 4
        },
        borderRadius: "14px",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 4px 24px rgba(28,37,54,0.035)"
      }}>
          <Stack component="ol" direction="row" aria-label={t("Giriş mərhələləri")} alignItems="center" spacing={1.5} sx={{
          listStyle: "none",
          p: 0,
          m: 0,
          mb: 4
        }}>
            <LoginStep number={1} label={t("Şirkət hesabı")} active={!challenge} complete={Boolean(challenge)} />
            <Box component="li" aria-hidden="true" sx={{
            width: 24,
            height: "1px",
            bgcolor: "divider",
            flexShrink: 0
          }} />
            <LoginStep number={2} label={t("Şəxsi PIN")} active={Boolean(challenge)} />
          </Stack>

          <Typography component="h1" id="login-heading" sx={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.6px",
          lineHeight: 1.3
        }}>
            {challenge ? t("Şəxsi PIN ilə davam et") : t("İş panelinə giriş")}
          </Typography>
          <Typography color="text.secondary" sx={{
          fontSize: 13,
          mt: 1,
          mb: 3,
          lineHeight: 1.7
        }}>
            {challenge ? t("Hesabına daxil olmaq üçün öz PIN kodunu yaz.") : t("Şirkətinə verilən e-poçt və şifrəni daxil et.")}
          </Typography>

          {challenge && <Stack direction="row" spacing={1.25} alignItems="center" sx={{
          bgcolor: "#f7f9fc",
          border: "1px solid",
          borderColor: "divider",
          p: 1.5,
          borderRadius: "8px",
          mb: 2.5
        }}>
              <BusinessOutlinedIcon sx={{
            color: "text.secondary",
            fontSize: 21,
            flexShrink: 0
          }} />
              <Box sx={{
            minWidth: 0
          }}>
                <Typography sx={{
              fontSize: 12.5,
              fontWeight: 500,
              overflowWrap: "anywhere"
            }}>
                  {challenge.company.name}
                </Typography>
                <Typography sx={{
              fontSize: 11.5,
              color: "text.secondary",
              mt: 0.25,
              overflowWrap: "anywhere"
            }}>
                  {email.trim()}
                </Typography>
              </Box>
            </Stack>}

          {error && <Alert severity="error" role="alert" sx={{
          mb: 2.5,
          fontSize: 12.5,
          borderRadius: "8px"
        }}>
              {error}
            </Alert>}

          <Box component="form" onSubmit={handleSubmit} aria-busy={loading}>
            <Stack spacing={2.5} key={challenge ? "pin-form" : "company-form"}>
              {!challenge ? <>
                  <Box>
                    <Typography component="label" htmlFor="company-email" sx={labelSx}>{t("Şirkətin e-poçtu")}</Typography>
                    <TextField id="company-email" name="username" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={t("sirket@zindex.invalid")} autoComplete="username" autoFocus required fullWidth disabled={loading} sx={fieldSx} inputProps={{
                  autoCapitalize: "none",
                  spellCheck: false
                }} InputProps={{
                  startAdornment: <InputAdornment position="start">
                            <AlternateEmailRoundedIcon sx={{
                      fontSize: 18
                    }} />
                          </InputAdornment>
                }} />
                  </Box>
                  <Box>
                    <Typography component="label" htmlFor="company-password" sx={labelSx}>{t("Şifrə")}</Typography>
                    <TextField id="company-password" name="password" type={showSecret ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={t("Şirkətin şifrəsi")} autoComplete="current-password" required fullWidth disabled={loading} sx={fieldSx} InputProps={{
                  startAdornment: <InputAdornment position="start">
                            <LockOutlinedIcon sx={{
                      fontSize: 18
                    }} />
                          </InputAdornment>,
                  endAdornment: secretAdornment
                }} />
                  </Box>
                </> : <Box>
                  <Typography component="label" htmlFor="personal-pin" sx={labelSx}>{t("Şəxsi PIN kod")}</Typography>
                  <TextField id="personal-pin" name="pin" type={showSecret ? "text" : "password"} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={t("PIN kodunu daxil et")} autoComplete="off" autoFocus required fullWidth disabled={loading} sx={fieldSx} helperText={t("PIN kodun 4–8 rəqəmdən ibarətdir.")} inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]{4,8}",
                minLength: 4,
                maxLength: 8
              }} FormHelperTextProps={{
                sx: {
                  mx: 0,
                  mt: 1,
                  fontSize: 11.5
                }
              }} InputProps={{
                startAdornment: <InputAdornment position="start">
                          <LockOutlinedIcon sx={{
                    fontSize: 18
                  }} />
                        </InputAdornment>,
                endAdornment: secretAdornment
              }} />
                </Box>}
              <Button type="submit" variant="contained" fullWidth disabled={loading} endIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardRoundedIcon sx={{
              fontSize: 18
            }} />} sx={{
              minHeight: 44,
              fontSize: 13,
              borderRadius: "8px",
              fontWeight: 500
            }}>
                {loading ? t("Yoxlanır…") : challenge ? "Daxil ol" : "Davam et"}
              </Button>
              {challenge && <Button type="button" onClick={changeCompany} disabled={loading} color="inherit" startIcon={<ArrowBackRoundedIcon sx={{
              fontSize: 16
            }} />} sx={{
              fontSize: 12,
              color: "text.secondary",
              minHeight: 32
            }}>{t("Başqa şirkətlə daxil ol")}</Button>}
            </Stack>
          </Box>
        <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={1} sx={{mt:2}}>{[['/renew','Renew subscription'],['/support','Support'],['/privacy','Privacy'],['/terms','Terms']].map(([to,label])=><Button component={RouterLink} to={to} size="small" key={to}>{t(label)}</Button>)}</Stack></Paper>

        <Typography sx={{
        mt: 2.75,
        textAlign: "center",
        fontSize: 11.5,
        lineHeight: 1.8,
        color: "text.secondary"
      }}>{t("Şirkət hesabı və şəxsi PIN ilə giriş")}</Typography>
        <Typography sx={{
        mt: 0.4,
        textAlign: "center",
        fontSize: 11,
        color: "text.secondary"
      }}>{t("z-Index · Biznes idarəetməsi")}</Typography>
      </Box>
    </Box>;
}
function LoginStep({
  number,
  label,
  active,
  complete
}) {
  useI18n();
  return <Stack component="li" direction="row" alignItems="center" spacing={0.75} aria-current={active ? "step" : undefined} sx={{
    minWidth: 0
  }}>
      <Box aria-hidden="true" sx={{
      width: 24,
      height: 24,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      flexShrink: 0,
      fontSize: 11,
      fontWeight: 500,
      bgcolor: active || complete ? "#edf2ff" : "#f1f3f7",
      color: active || complete ? "primary.main" : "text.secondary"
    }}>
        {complete ? <CheckRoundedIcon sx={{
        fontSize: 15
      }} /> : number}
      </Box>
      <Typography sx={{
      fontSize: 11.5,
      fontWeight: active ? 500 : 400,
      color: active ? "text.primary" : "text.secondary"
    }}>
        {label}
      </Typography>
    </Stack>;
}
const labelSx = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 500,
  mb: 0.85,
  color: "text.primary"
};
