// src/pages/InvoiceDoc.jsx
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  PDFViewer
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12 },
  header: { fontSize: 18, marginBottom: 10 },
  table: { display: 'table', width: 'auto', marginTop: 10 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, borderWidth: 1, padding: 4 }
});

export function InvoiceDocument({ order, items }) {
  const total = items.reduce((sum, i) => sum + i.quantity * i.price_at_time, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Invoice #{order.order_id}</Text>
        <Text>Date: {new Date(order.order_date).toLocaleDateString()}</Text>
        <Text>Customer: {order.name}</Text>

        <View style={styles.table}>
          <View style={[styles.row, { backgroundColor: '#eee' }]}>
            <Text style={styles.cell}>Item</Text>
            <Text style={styles.cell}>Qty</Text>
            <Text style={styles.cell}>Price</Text>
          </View>
          {items.map(i => (
            <View style={styles.row} key={i.product_id}>
              <Text style={styles.cell}>{i.name}</Text>
              <Text style={styles.cell}>{i.quantity}</Text>
              <Text style={styles.cell}>
                ${(i.quantity * i.price_at_time).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.cell}>Total</Text>
            <Text style={styles.cell} />
            <Text style={styles.cell}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function InvoiceViewer({ order, items }) {
  return (
    <PDFViewer width="100%" height="600px">
      <InvoiceDocument order={order} items={items} />
    </PDFViewer>
  );
}

export function InvoiceDownloadLink({ order, items }) {
  return (
    <PDFDownloadLink
      document={<InvoiceDocument order={order} items={items} />}
      fileName={`invoice_${order.order_id}.pdf`}
    >
      {({ loading }) => (loading ? 'Preparing invoice...' : 'Download Invoice PDF')}
    </PDFDownloadLink>
  );
}
