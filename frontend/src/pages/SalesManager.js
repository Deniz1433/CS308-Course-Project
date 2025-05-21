import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Button, Accordion,
  AccordionSummary, AccordionDetails, CircularProgress,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";

import format from "date-fns/format";

const SalesManager = () => {
  const navigate = useNavigate();

  // —— Products & Refunds —— //
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [priceUpdates, setPriceUpdates] = useState({});
  const [discountRates, setDiscountRates] = useState({});
  const [updating, setUpdating] = useState({});

  const [refunds, setRefunds] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(true);

  useEffect(() => {
    fetchUnpricedProducts();
    fetchRefundRequests();
  }, []);

  // Products
  const fetchUnpricedProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      console.error("Failed to fetch unpriced products:", e);
    } finally {
      setLoadingProducts(false);
    }
  };
    // Invoice‐viewer state
  const [viewingInvoiceUrl, setViewingInvoiceUrl] = useState(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  
  const handleAccordionChange = id => (e, expanded) =>
    setExpandedProduct(expanded ? id : null);

  const handlePriceChange = (id, v) =>
    setPriceUpdates(px => ({ ...px, [id]: v }));

  const handleDiscountChange = (id, v) =>
    setDiscountRates(d => ({ ...d, [id]: v }));

  const handleSetPrice = async id => {
    const price = parseFloat(priceUpdates[id]);
    if (isNaN(price) || price <= 0) {
      return alert("Please enter a valid price");
    }
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      const res = await fetch(`/api/set-price/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to set price");
      }
      setProducts(ps =>
        ps.map(p =>
          p.id === id ? { ...p, price, final_price: price } : p
        )
      );
      alert("Price set successfully");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setUpdating(u => ({ ...u, [id]: false }));
    }
  };

  const fetchProductById = async id => {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error("Fetch product failed");
      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleApplyDiscount = async id => {
    const discount = parseFloat(discountRates[id]);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      return alert("Enter a discount between 0 and 100");
    }
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      const res = await fetch(`/api/apply-discount/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountRate: discount })
      });
      if (!res.ok) throw new Error("Failed to apply discount");
      const updated = await fetchProductById(id);
      if (!updated) throw new Error("Failed to refresh product");
      setProducts(ps => ps.map(p => (p.id === id ? updated : p)));
      alert("Discount applied");
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setUpdating(u => ({ ...u, [id]: false }));
    }
  };

  const handleCancelDiscount = async id => {
    setUpdating(u => ({ ...u, [id]: true }));
    try {
      const res = await fetch(`/api/cancel-discount/${id}`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to cancel discount");
      const data = await res.json(); // { restoredPrice }
      setProducts(ps =>
        ps.map(p =>
          p.id === id
            ? { ...p, price: data.restoredPrice, final_price: data.restoredPrice }
            : p
        )
      );
      alert("Discount canceled");
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setUpdating(u => ({ ...u, [id]: false }));
    }
  };

  // Refunds
  const fetchRefundRequests = async () => {
    try {
      const res = await fetch("/api/refund-requests");
      setRefunds(await res.json());
    } catch (e) {
      console.error("Failed to load refunds", e);
    } finally {
      setLoadingRefunds(false);
    }
  };

  const approveRefund = async (id) => {
  if (!window.confirm("Approve this refund?")) return;

  // include credentials if you ever lock this route down
  const res = await fetch(`/api/refund-requests/${id}/approve`, {
    method: "PUT",
    credentials: "include",
  });
  const data = await res.json();

  // ❶ bail on non-2xx
  if (!res.ok) {
    return alert(data.error || "Approval failed");
  }

  // ❷ only remove from UI on success
  alert(data.message);
  setRefunds((r) => r.filter(x => x.id !== id));
};

  // —— Sales Report —— //
  const [range, setRange] = useState({ start: null, end: null });
  const [invoices, setInvoices] = useState(null);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    // default last 7 days
    const today = new Date();
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 7);
    setRange({ start: last7, end: today });
  }, []);

  const fetchInvoices = async (s, e) => {
    try {
      const res = await fetch(`/api/invoice?start=${s}&end=${e}`, {
        credentials: "include"
      });
      if (res.status === 403) return setInvoices([]);
      if (!res.ok) {
        console.error("Fetch invoices error:", res.status);
        return setInvoices([]);
      }
      setInvoices(await res.json());
    } catch (err) {
      console.error(err);
      setInvoices([]);
    }
  };

  const fetchReport = async (s, e) => {
    try {
      const res = await fetch(`/api/report?start=${s}&end=${e}`, {
        credentials: "include"
      });
      if (res.status === 403) return setReport([]);
      if (!res.ok) {
        console.error("Fetch report error:", res.status);
        return setReport([]);
      }
      setReport(await res.json());
    } catch (err) {
      console.error(err);
      setReport([]);
    }
  };

  const handleRefresh = async () => {
    if (!range.start || !range.end) return;
    setLoadingReport(true);
    const startStr = range.start.toISOString().slice(0, 10);
    const endStr = range.end.toISOString().slice(0, 10);
    await Promise.all([fetchInvoices(startStr, endStr), fetchReport(startStr, endStr)]);
    setLoadingReport(false);
  };

  useEffect(() => {
    if (range.start && range.end) handleRefresh();
  }, [range.start, range.end]);

  // —— Render —— //
  if (loadingProducts) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
  <Box p={3}>
    <Button
      variant="contained"
      sx={{ mb: 2 }}
      onClick={() => navigate("/unpriced-products")}
    >
      View Unpriced Products
    </Button>

    <Typography variant="h4" gutterBottom>
      Products
    </Typography>
    {products.length === 0 ? (
      <Typography>No products available</Typography>
    ) : (
      products.map(p => (
        <Accordion
          key={p.id}
          expanded={expandedProduct === p.id}
          onChange={handleAccordionChange(p.id)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>{p.name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>Description: {p.description}</Typography>
            {p.price && (
              <Typography mt={1}>
                Original Price: <strong>${p.price}</strong>
              </Typography>
            )}
            {p.final_price != null && (
              <Typography mt={1}>
                Final Price: <strong>${p.final_price}</strong>
              </Typography>
            )}

            <Box mt={2}>
              <TextField
                label="Set Price"
                type="number"
                fullWidth
                value={priceUpdates[p.id] || ""}
                onChange={e => handlePriceChange(p.id, e.target.value)}
              />
              <Button
                sx={{ mt: 1 }}
                variant="contained"
                disabled={updating[p.id]}
                onClick={() => handleSetPrice(p.id)}
              >
                {updating[p.id] ? "Updating…" : "Set Price"}
              </Button>
            </Box>

            <Box mt={3}>
              <TextField
                label="Discount Rate (%)"
                type="number"
                fullWidth
                value={discountRates[p.id] || ""}
                onChange={e => handleDiscountChange(p.id, e.target.value)}
              />
              <Box mt={1} display="flex" gap={1}>
                <Button
                  variant="contained"
                  disabled={updating[p.id]}
                  onClick={() => handleApplyDiscount(p.id)}
                >
                  {updating[p.id] ? "Applying…" : "Apply Discount"}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={updating[p.id]}
                  onClick={() => handleCancelDiscount(p.id)}
                >
                  {updating[p.id] ? "Cancelling…" : "Cancel Discount"}
                </Button>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))
    )}

    <Typography variant="h4" gutterBottom mt={6}>
      Pending Refund Requests
    </Typography>
    {loadingRefunds ? (
      <CircularProgress />
    ) : refunds.length === 0 ? (
      <Typography>No pending refund requests</Typography>
    ) : (
      refunds.map(r => (
        <Paper key={r.id} sx={{ p: 2, mb: 2 }}>
          <Typography>
            <strong>Customer:</strong> {r.customer_name}
          </Typography>
          <Typography>
            <strong>Product:</strong> {r.product_name}
          </Typography>
          <Typography>
            <strong>Order ID:</strong> {r.order_id}
          </Typography>
          <Typography>
            <strong>Quantity:</strong> {r.quantity}
          </Typography>
          <Typography>
            <strong>Requested on:</strong>{" "}
            {format(new Date(r.request_date), "dd/MM/yyyy HH:mm")}
          </Typography>
          <Button
            variant="contained"
            color="success"
            sx={{ mt: 1 }}
            onClick={() => approveRefund(r.id)}
          >
            Approve Refund
          </Button>
        </Paper>
      ))
    )}

    {/* —— Sales Report Section —— */}
    <Box mt={8}>
      <Typography variant="h4" gutterBottom>
        Sales Report
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <DatePicker
            label="Start Date"
            value={range.start}
            onChange={v => setRange(r => ({ ...r, start: v }))}
            renderInput={props => <TextField {...props} />}
          />
          <DatePicker
            label="End Date"
            value={range.end}
            onChange={v => setRange(r => ({ ...r, end: v }))}
            renderInput={props => <TextField {...props} />}
          />
          <Button
            variant="contained"
            onClick={handleRefresh}
            disabled={loadingReport}
          >
            Refresh
          </Button>
        </Box>
      </LocalizationProvider>

      <Paper sx={{ p: 2, mb: 4 }} elevation={2}>
        <Typography variant="h6" mb={2}>
          Invoices
        </Typography>
        {loadingReport || invoices === null ? (
          <CircularProgress />
        ) : invoices.length > 0 ? (
          invoices.map(inv => (
            <Box
              key={inv.id}
              display="flex"
              justifyContent="space-between"
              p={1}
              borderBottom="1px solid #eee"
            >
              <Typography>#{inv.id}</Typography>
              <Typography>
                {format(new Date(inv.date), "dd/MM/yyyy HH:mm")}
              </Typography>
              <Typography>{inv.customer}</Typography>
              <Typography>${inv.total.toFixed(2)}</Typography>
              <Button
                size="small"
                disabled={viewingLoading}
                onClick={async () => {
                  setViewingLoading(true);
                  try {
                    const res = await fetch(`/api/invoice/${inv.id}`, {
                      credentials: "include",
                    });
                    if (!res.ok) throw new Error("Invoice not found");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setViewingInvoiceUrl(url);
                    setViewingInvoiceId(inv.id);
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setViewingLoading(false);
                  }
                }}
              >
                {viewingLoading ? (
                  <CircularProgress size={16} />
                ) : (
                  "View PDF"
                )}
              </Button>
            </Box>
          ))
        ) : (
          <Typography>No invoices to show</Typography>
        )}
      </Paper>

      <Typography variant="h6" gutterBottom>
        Revenue vs. Profit
      </Typography>
      {loadingReport || report === null ? (
        <CircularProgress />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={report}>
            <XAxis
              dataKey="day"
              tickFormatter={d => format(new Date(d), "dd/MM")}
            />
            <YAxis />
            <Tooltip
              labelFormatter={d => format(new Date(d), "dd/MM/yyyy")}
            />
            <Bar dataKey="revenue" name="Revenue" />
            <Bar dataKey="profit" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Box>

    {/* Invoice Viewer Dialog */}
    <Dialog
      open={Boolean(viewingInvoiceUrl)}
      onClose={() => {
        setViewingInvoiceUrl(null);
        setViewingInvoiceId(null);
      }}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>Invoice #{viewingInvoiceId}</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {viewingInvoiceUrl && (
          <Box
            component="iframe"
            src={viewingInvoiceUrl}
            width="100%"
            height="600px"
            sx={{ border: 0 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const a = document.createElement("a");
            a.href = viewingInvoiceUrl;
            a.download = `invoice_${viewingInvoiceId}.pdf`;
            a.click();
          }}
        >
          Download
        </Button>
        <Button
          onClick={() => {
            setViewingInvoiceUrl(null);
            setViewingInvoiceId(null);
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  </Box>
);
};

export default SalesManager;
