// components/SalesQueryBuilder.jsx
import React, { useState } from 'react';
import { QueryBuilder } from '@cubejs-client/react';

function SalesQueryBuilder() {
  // Initial query with your metrics
  const [vizState, setVizState] = useState({
    query: {
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
    }
  });

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Sales Query Builder</h2>
      
      <QueryBuilder
        query={vizState.query}
        setQuery={(query) => setVizState({ ...vizState, query })}
        render={({
          resultSet,
          measures,
          availableMeasures,
          updateMeasures,
          dimensions,
          availableDimensions,
          updateDimensions,
          filters,
          updateFilters,
          isQueryPresent,
          loading,
          error
        }) => (
          <div>
            {/* Measures Selector */}
            <div style={{ marginBottom: '20px' }}>
              <h3>Select Measures:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {availableMeasures.map((measure) => (
                  <label key={measure.name} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={measures.includes(measure.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateMeasures.add(measure);
                        } else {
                          updateMeasures.remove(measure);
                        }
                      }}
                    />
                    <span style={{ marginLeft: '5px' }}>{measure.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dimensions Selector */}
            <div style={{ marginBottom: '20px' }}>
              <h3>Select Dimensions:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {availableDimensions.map((dimension) => (
                  <label key={dimension.name} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={dimensions.includes(dimension.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateDimensions.add(dimension);
                        } else {
                          updateDimensions.remove(dimension);
                        }
                      }}
                    />
                    <span style={{ marginLeft: '5px' }}>{dimension.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Loading and Error States */}
            {loading && <div>Loading...</div>}
            {error && <div style={{ color: 'red' }}>Error: {error.toString()}</div>}

            {/* Results Table */}
            {resultSet && !loading && (
              <div>
                <h3>Results:</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        {resultSet.tableColumns().map((column) => (
                          <th key={column.key} style={{ padding: '10px' }}>
                            {column.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultSet.tablePivot().map((row, i) => (
                        <tr key={i}>
                          {resultSet.tableColumns().map((column) => (
                            <td key={column.key} style={{ 
                              padding: '10px',
                              textAlign: column.key.includes('revenue') || 
                                        column.key.includes('paid') || 
                                        column.key.includes('tax') ||
                                        column.key.includes('refund') ||
                                        column.key.includes('amount') ||
                                        column.key.includes('size') ? 'right' : 'left'
                            }}>
                              {column.key.includes('revenue') || 
                               column.key.includes('paid') || 
                               column.key.includes('tax') ||
                               column.key.includes('refund') ||
                               column.key.includes('amount') ||
                               column.key.includes('size')
                                ? formatCurrency(row[column.key])
                                : row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9' }}>
                  <strong>Total Records: </strong>{resultSet.tablePivot().length}
                </div>
              </div>
            )}

            {/* Show Current Query */}
            <details style={{ marginTop: '30px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                View Current Query
              </summary>
              <pre style={{ backgroundColor: '#f5f5f5', padding: '15px', overflow: 'auto' }}>
                {JSON.stringify(vizState.query, null, 2)}
              </pre>
            </details>
          </div>
        )}
      />
    </div>
  );
}

export default SalesQueryBuilder;