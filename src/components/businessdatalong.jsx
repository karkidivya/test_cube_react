import React, { useState } from 'react';
import cubejs from '@cubejs-client/core';

const cubejsApi = cubejs('YOUR_TOKEN', {
  apiUrl: 'http://localhost:4000/cubejs-api/v1'
});

const BusinessSalesTable = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await cubejsApi.load({
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
            values: ['2025-05-24', '2025-05-27']
          }
        ]
      });
      
      setData(result.tablePivot());
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div>
      <h3>Business Sales Data</h3>
      <button onClick={fetchData}>
        {loading ? 'Loading...' : 'Load Data'}
      </button>
      
      {data && data.length > 0 && (
        <table border="1" style={{ marginTop: '20px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {Object.keys(data[0]).map((header, i) => (
                <th key={i} style={{ padding: '8px' }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((value, j) => (
                  <td key={j} style={{ padding: '8px' }}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BusinessSalesTable;