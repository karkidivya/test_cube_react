// components/SalesData.jsx
import React from 'react';
import { useCubeQuery } from '@cubejs-client/react';

function SalesData() {
  const { resultSet, isLoading, error } = useCubeQuery({
    measures: [
      'business_sales.gross_revenue',
      'business_sales.net_revenue',
      'business_sales.gross_cash_revenue',
      'business_sales.gross_card_revenue',
      'business_sales.gross_paid',
      'business_sales.gross_tax',
      'business_sales.discount_amount',
      'business_sales.average_check_size',
      'business_sales.cash_refund',
      'business_sales.card_refund'
    ],
    dimensions: [
      'business_sales.SalesBusinessID',
      'business_sales.SalesBusinessName',
      'business_sales.TransactionDate'
    ],
    filters: [
      {
        member: 'business_sales.SalesBusinessID',
        operator: 'equals',
        values: ['104']
      },
      {
        member: 'business_sales.TransactionDate',
        operator: 'inDateRange',
        values: ['2025-05-24', '2025-05-28']
      }
    ]
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error.toString()}</div>;
  if (!resultSet) return <div>No data</div>;

  const data = resultSet.tablePivot();

  // Format currency
  const formatCurrency = (value) => {
    return `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format percentage or number
  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div>
      <h2>Sales Data for Business ID: 104</h2>
      <p style={{ color: 'red', marginBottom: '20px' }}>Date Range: May 24, 2025 - May 27, 2025</p>
      
      <div style={{ overflowX: 'auto' }}>
        <table border="1" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1200px' }}>
          <thead>
            <tr style={{ backgroundColor: 'red' }}>
              <th style={{ padding: '10px', position: 'sticky', left: 0, backgroundColor: 'red' }}>Date</th>
              <th style={{ padding: '10px' }}>Business ID</th>
              <th style={{ padding: '10px' }}>Business Name</th>
              <th style={{ padding: '10px' }}>Gross Revenue</th>
              <th style={{ padding: '10px' }}>Net Revenue</th>
              <th style={{ padding: '10px' }}>Cash Revenue</th>
              <th style={{ padding: '10px' }}>Card Revenue</th>
              <th style={{ padding: '10px' }}>Gross Paid</th>
              <th style={{ padding: '10px' }}>Tax</th>
              <th style={{ padding: '10px' }}>Discount</th>
              <th style={{ padding: '10px' }}>Avg Check Size</th>
              <th style={{ padding: '10px' }}>Cash Refund</th>
              <th style={{ padding: '10px' }}>Card Refund</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '10px', position: 'sticky', left: 0, backgroundColor: 'red' }}>
                  {row['business_sales.TransactionDate']}
                </td>
                <td style={{ padding: '10px' }}>
                  {row['business_sales.SalesBusinessID']}
                </td>
                <td style={{ padding: '10px' }}>
                  {row['business_sales.SalesBusinessName']}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.gross_revenue'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.net_revenue'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.gross_cash_revenue'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.gross_card_revenue'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.gross_paid'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.gross_tax'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.discount_amount'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.average_check_size'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.cash_refund'])}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  {formatCurrency(row['business_sales.card_refund'])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      {data.length > 0 && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: 'red', borderRadius: '5px' }}>
          <h3>Summary</h3>
          <p>Total Records: {data.length}</p>
        </div>
      )}
    </div>
  );
}

export default SalesData;