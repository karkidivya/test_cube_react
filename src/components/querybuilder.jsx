// components/SimpleQueryBuilder.jsx
import React from 'react';
import { QueryBuilder } from '@cubejs-client/react';
import { cubeApi } from '../config/cube';

function SimpleQueryBuilder() {
  // Pre-defined query with all your metrics
  const initialQuery = {
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
  };

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <QueryBuilder
      query={initialQuery}
      cubeApi={cubeApi}
      render={({ resultSet, error, loadingState }) => {
        if (loadingState?.isLoading) {
          return <div>Loading...</div>;
        }

        if (error) {
          return <div style={{ color: 'red' }}>Error: {error.toString()}</div>;
        }

        if (!resultSet) {
          return <div>No data available</div>;
        }

        const data = resultSet.tablePivot();
        const columns = resultSet.tableColumns();

        return (
          <div>
            <h2>Sales Data - Query Builder</h2>
            <p style={{ color: '#666' }}>Business ID: 104 | Date: May 24-27, 2025</p>
            
            <div style={{ overflowX: 'auto' }}>
              <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    {columns.map((col) => (
                      <th key={col.key} style={{ padding: '10px' }}>
                        {col.shortTitle || col.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td key={col.key} style={{ 
                          padding: '10px',
                          textAlign: col.key.includes('business_sales.Sales') ? 'left' : 'right'
                        }}>
                          {col.key.includes('revenue') || 
                           col.key.includes('paid') || 
                           col.key.includes('tax') ||
                           col.key.includes('refund') ||
                           col.key.includes('amount') ||
                           col.key.includes('size')
                            ? formatCurrency(row[col.key])
                            : row[col.key] || 'N/A'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    />
  );
}

export default SimpleQueryBuilder;