import LedgerDialog from "../components/LedgerDialog";
import { useI18n } from "../i18n/useI18n";
import { t } from "../i18n/runtime";
import { RecordPager, ImportButton, ExportButton } from "../components/RecordsTools";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, InputAdornment, Link, MenuItem, Stack, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { canUseFeature } from "../features/plans/access";
import { useAuth } from "../features/auth/useAuth";
import { getCustomers } from "../lib/customers";
import { api } from "../lib/api";
import { PageLayout, PageHeader, PageCard, DataTable, EmptyState, StatusBadge, RecordDate } from "../components/WorkspaceUI";
export default function CustomersPage() {
  useI18n();
  const {
    user: currentUser
  } = useAuth();
  const canFilterExpeditor = canUseFeature(currentUser, "teamManagement") && ["ADMIN", "DRIVER", "WAREHOUSE"].includes(currentUser?.role);
  const showAssignments = canUseFeature(currentUser, "customerAssignments");
  const [collect,setCollect]=useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [expeditors, setExpeditors] = useState([]);
  const [search, setSearch] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!canFilterExpeditor) return;
    let active = true;
    async function loadExpeditors() {
      try {
        const {
          data
        } = await api.get("/users", {
          params: {
            role: "EXPEDITOR"
          }
        });
        if (active) setExpeditors(data.users || []);
      } catch {
        if (active) setExpeditors([]);
      }
    }
    loadExpeditors();
    return () => {
      active = false;
    };
  }, [canFilterExpeditor]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getCustomers(search, canFilterExpeditor ? expeditorId : "", {
          page,
          limit: 25
        });
        if (active) {
          setCustomers(data.customers || []);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (active) setError(err?.response?.data?.message || t("Müştərilər yüklənmədi. Yenidən cəhd et."));
      } finally {
        if (active) setLoading(false);
      }
    }, search.trim() ? 350 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, expeditorId, reloadKey, canFilterExpeditor, page]);
  function resetFilters() {
    setPage(1);
    setSearch("");
    setExpeditorId("");
    setReloadKey(key => key + 1);
  }
  return <PageLayout>
      <PageHeader title={t("Müştərilər")} description={t("Müştəri məlumatları, satışlar və borclar.")} actions={<>
            {currentUser?.role === "ADMIN" && <>
                <ExportButton kind="customers" />
                <ImportButton kind="customers" onDone={() => setReloadKey(k => k + 1)} />
              </>}
            <Button variant="outlined" disabled={loading} onClick={() => setReloadKey(key => key + 1)} startIcon={<RefreshRoundedIcon sx={{
        fontSize: 18
      }} />}>{t("Yenilə")}</Button>
          </>} />
      <PageCard sx={{
      p: 2,
      mb: 2.5
    }}>
        <Stack direction={{
        xs: "column",
        md: "row"
      }} spacing={1.5} alignItems={{
        md: "center"
      }}>
          <TextField label={t("Müştəri axtar")} placeholder={t("Ad, telefon və ya salon")} value={search} onChange={event => {
          setSearch(event.target.value);
          setPage(1);
        }} fullWidth InputProps={{
          startAdornment: <InputAdornment position="start">
                  <SearchRoundedIcon sx={{
              fontSize: 18,
              color: "text.secondary"
            }} />
                </InputAdornment>
        }} sx={{
          flex: 1,
          minWidth: 0
        }} />
          {canFilterExpeditor && <TextField select label={t("Ekspeditor")} value={expeditorId} onChange={event => {
          setExpeditorId(event.target.value);
          setPage(1);
        }} sx={{
          minWidth: {
            md: 200
          }
        }}>
              <MenuItem value="">{t("Hamısı")}</MenuItem>
              {expeditors.map(person => <MenuItem key={person.id} value={person.id}>
                  {person.fullName || person.email || "—"}
                </MenuItem>)}
            </TextField>}
          <Button color="inherit" onClick={resetFilters} sx={{
          color: "text.secondary",
          alignSelf: {
            xs: "flex-start",
            md: "center"
          }
        }}>{t("Sıfırla")}</Button>
        </Stack>
      </PageCard>
      {error && <Alert severity="error" sx={{
      mb: 2
    }}>
          {error}
        </Alert>}
      <PageCard>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{
        px: 2,
        py: 1.75,
        borderBottom: "1px solid",
        borderColor: "divider"
      }}>
          <Typography component="h2" sx={{
          fontSize: 14,
          fontWeight: 500
        }}>{t("Müştəri siyahısı")}</Typography>
          <Typography sx={{
          fontSize: 11.5,
          color: "text.secondary"
        }}>
            {loading ? t("Yüklənir…") : error ? t("Yüklənmə alınmadı") : (pagination?.total ?? customers.length) + " nəticə"}
          </Typography>
        </Stack>
        {loading ? <Box role="status" aria-label={t("Müştərilər yüklənir")} sx={{
        py: 7,
        textAlign: "center"
      }}>
            <CircularProgress size={24} />
          </Box> : error ? <EmptyState title={t("Siyahı yenilənmədi")} description={t("Yenilə düyməsi ilə təkrar yoxla.")} /> : customers.length === 0 ? <EmptyState title={t("Müştəri tapılmadı")} description={t("Axtarış sözünü və filtrləri dəyişərək yenidən yoxla.")} /> : <DataTable minWidth={showAssignments ? 850 : 690} label={t("Müştərilər siyahısı")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("Müştəri / salon")}</TableCell>
                <TableCell>{t("Telefon")}</TableCell>
                <TableCell>{t("Ünvan")}</TableCell>
                {showAssignments && <TableCell>{t("Ekspeditor")}</TableCell>}
                <TableCell>{t("Son yenilənmə")}</TableCell>
                <TableCell align="right">{t("Ətraflı")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map(customer => <TableRow key={customer.id} hover>
                  <TableCell sx={{
              maxWidth: 310
            }}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Link component={RouterLink} to={"/exp/customers/" + customer.id} underline="hover" color="text.primary" sx={{
                  fontWeight: 500,
                  overflowWrap: "anywhere"
                }}>
                        {customer.name || t("Adsız müştəri")}
                      </Link>
                      {customer.isProblematic && <StatusBadge label={t("Problemli")} tone="error" />}
                    </Stack>
                    <Typography sx={{
                fontSize: 11.5,
                color: "text.secondary",
                mt: 0.35,
                overflowWrap: "anywhere"
              }}>
                      {customer.salon || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{
              whiteSpace: "nowrap"
            }}>
                    {customer.phone ? <Link href={"tel:" + customer.phone} color="inherit" underline="hover">
                        {customer.phone}
                      </Link> : "—"}
                  </TableCell>
                  <TableCell sx={{
              maxWidth: 240,
              overflowWrap: "anywhere",
              color: "text.secondary"
            }}>
                    {customer.address || "—"}
                  </TableCell>
                  {showAssignments && <TableCell>
                      {customer.assignedExpeditor?.fullName || customer.assignedExpeditor?.email || "—"}
                    </TableCell>}
                  <TableCell>
                    <RecordDate value={customer.updatedAt} />
                  </TableCell>
                  <TableCell align="right">
                    {customer.summary?.debt>0 && <Button size="small" onClick={()=>setCollect(customer)}>{t("Record payment")}</Button>}
                    <Button component={RouterLink} to={"/exp/customers/" + customer.id} size="small" endIcon={<ArrowForwardRoundedIcon sx={{
                fontSize: "15px !important"
              }} />} sx={{
                minWidth: 0,
                fontSize: 12
              }}>{t("Bax")}</Button>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </DataTable>}
        <RecordPager pagination={pagination} onChange={setPage} disabled={loading} />
      </PageCard>
      {collect&&<LedgerDialog customer={collect} onClose={()=>setCollect(null)} onSaved={()=>setReloadKey(x=>x+1)}/>}
    </PageLayout>;
}
