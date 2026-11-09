import {
  Box,
  Paper,
  Stack,
  Table,
  TableContainer,
  Typography,
} from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";

export function PageLayout({ children }) {
  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, lg: 3.5 },
        py: { xs: 3, md: 3.5 },
        maxWidth: 1600,
        mx: "auto",
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ sm: "center" }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 24, md: 28 },
            fontWeight: 600,
            letterSpacing: "-0.7px",
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography sx={{ mt: 0.6, fontSize: 13, color: "text.secondary" }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export function PageCard({ children, sx, ...props }) {
  return (
    <Paper
      elevation={0}
      {...props}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "12px",
        minWidth: 0,
        overflow: "hidden",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

export function DataTable({
  children,
  minWidth = 620,
  label = "Məlumat cədvəli",
}) {
  return (
    <TableContainer tabIndex={0} aria-label={label} sx={{ overflowX: "auto" }}>
      <Table
        size="small"
        sx={{
          minWidth,
          "& th": {
            whiteSpace: "nowrap",
            fontSize: 11.5,
            fontWeight: 500,
            color: "text.secondary",
            bgcolor: "#fafbfc",
          },
          "& td": { fontSize: 12.5, verticalAlign: "middle" },
          "& th, & td": { px: 2, py: 1.65 },
          "& tr:last-child td": { borderBottom: 0 },
        }}
      >
        {children}
      </Table>
    </TableContainer>
  );
}

export function EmptyState({
  title = "Məlumat tapılmadı",
  description,
  action,
}) {
  return (
    <Box sx={{ py: 6, px: 3, textAlign: "center" }}>
      <InboxOutlinedIcon sx={{ fontSize: 30, color: "#9aa5b5", mb: 1 }} />
      <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{title}</Typography>
      {description && (
        <Typography sx={{ mt: 0.5, fontSize: 12, color: "text.secondary" }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export function StatusBadge({ label, tone = "neutral" }) {
  const colors = {
    neutral: ["#f0f3f8", "#536079"],
    success: ["#eaf6ef", "#20704f"],
    warning: ["#fff6e7", "#93601d"],
    error: ["#fff0ef", "#b53b35"],
    info: ["#edf2ff", "#315be8"],
  };
  const [bgcolor, color] = colors[tone] || colors.neutral;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "5px",
        px: 0.85,
        py: 0.35,
        bgcolor,
        color,
        fontSize: 10.5,
        lineHeight: 1.5,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

export function RecordDate({ value }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime()))
    return <Typography sx={{ fontSize: 12 }}>—</Typography>;
  return (
    <Box sx={{ whiteSpace: "nowrap" }}>
      <Typography sx={{ fontSize: 12 }}>
        {date.toLocaleDateString("az-AZ", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 10.5, color: "text.secondary" }}>
        {date.toLocaleTimeString("az-AZ", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Typography>
    </Box>
  );
}