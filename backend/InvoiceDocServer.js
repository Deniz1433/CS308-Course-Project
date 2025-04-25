// InvoiceDocServer.js
const React = require('react');
const {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf  // the PDF factory
} = require('@react-pdf/renderer');

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 12 },
  header: { fontSize: 18, marginBottom: 10 },
  table: { display: 'table', width: 'auto', marginTop: 10 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, borderWidth: 1, padding: 4 }
});

/**
 * A pure‐JS (no JSX) version of your InvoiceDocument
 */
function InvoiceDocument(props) {
  const { order, items } = props;
  const total = items.reduce((sum, i) => sum + i.quantity * i.price_at_time, 0);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.header }, `Invoice #${order.order_id}`),
      React.createElement(Text, null, `Date: ${new Date(order.order_date).toLocaleDateString()}`),
      React.createElement(Text, null, `Customer: ${order.name}`),

      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: [styles.row, { backgroundColor: '#eee' }] },
          React.createElement(Text, { style: styles.cell }, 'Item'),
          React.createElement(Text, { style: styles.cell }, 'Qty'),
          React.createElement(Text, { style: styles.cell }, 'Price')
        ),

        // rows
        ...items.map(i =>
          React.createElement(
            View,
            { style: styles.row, key: i.product_id },
            React.createElement(Text, { style: styles.cell }, i.name),
            React.createElement(Text, { style: styles.cell }, String(i.quantity)),
            React.createElement(
              Text,
              { style: styles.cell },
              `$${(i.quantity * i.price_at_time).toFixed(2)}`
            )
          )
        ),

        // total row
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.cell }, 'Total'),
          React.createElement(Text, { style: styles.cell }, ''),
          React.createElement(Text, { style: styles.cell }, `$${total.toFixed(2)}`)
        )
      )
    )
  );
}

module.exports = { InvoiceDocument, pdf };
