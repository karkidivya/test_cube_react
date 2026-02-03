// components/AdvancedPeriodReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { cubeApi } from '../config/cube';

// View configurations with their specific filters
const VIEW_CONFIGS = {
  period_transaction_report_sales: {
    name: 'Sales Metrics',
    businessIdField: 'SalesBusinessID',
    dateField: 'TransactionDate',
    measures: [
      'total_transactions',
      'net_revenue',
      'net_cash_revenue',
      'net_card_revenue',
      'avg_net_check_size',
      'appointment_transaction_percentage',
      'average_time_per_transaction',
      'average_time_per_transaction_22',
      'average_wait_time_of_complete_transactions',
      'average_wait_time_of_cancelled_transactions',
      'gross_card_tip',
      'cash_percent',
      'gross_cash_tip',
      'gross_cashback',
      'credit_percent',
      'discount_amount',
      'discount_percentage_of_net',
      'gross_fees',
      'gross_gift_redeemeption',
      'gross_cash_revenue',
      'gross_card_revenue',
      'gross_revenue',
      'total_refund',
      'cash_refund',
      'card_refund',
      'new_visits',
      'new_visits_percentage',
      'repeat_visits',
      'repeat_visits_percentage',
      'gross_tip',
      'gross_tax',
      'walkin_transaction'
    ]
  },
  period_transaction_report_appt: {
    name: 'Appointment Metrics',
    businessIdField: 'AppointmentBusinessId',
    dateField: 'AppointmentDay',
    measures: [
      'appointment_sales',
      'appointments_created_in_period',
      'appointments_scheduled_for_period',
      'total_cancelled_appointments'
    ]
  },
  period_transaction_report_servicequeue: {
    name: 'Service Queue Metrics',
    businessIdField: 'ServiceQueuueBusinessID',
    dateField: 'ServiceQueueTransactionDate',
    measures: [
      'appointments',
      'average_service_time',
      'total_cancelled_service',
      'deleted_before_service',
      'deleted_after_service'
    ]
  },
  period_transaction_report_phone: {
    name: 'Phone/Text Metrics',
    businessIdField: 'TextBusinessID',
    dateField: null, // No date field for this view
    measures: ['Unsubscribed']
  }
};

function AdvancedPeriodReport() {
  const [businessId, setBusinessId] = useState('104');
  const [dateRange, setDateRange] = useState(['2025-05-24', '2025-05-27']);
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'day', 'week', 'month'
  const [selectedViews, setSelectedViews] = useState(Object.keys(VIEW_CONFIGS));
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  // Build queries for each selected view
  const buildQuery = (viewKey, config) => {
    const query = {
      measures: config.measures
        .filter(m => m !== undefined)
        .map(m => `${viewKey}.${m}`),
      dimensions: [],
      filters: []
    };

    // Add business ID filter
    if (config.businessIdField) {
      query.dimensions.push(`${viewKey}.${config.businessIdField}`);
      query.filters.push({
        member: `${viewKey}.${config.businessIdField}`,
        operator: 'equals',
        values: [businessId]
      });
    }

    // Add date dimension and filter
    if (config.dateField) {
      if (groupBy !== 'none') {
        query.timeDimensions = [{
          dimension: `${viewKey}.${config.dateField}`,
          granularity: groupBy
        }];
      } else {
        query.dimensions.push(`${viewKey}.${config.dateField}`);
      }
      
      query.filters.push({
        member: `${viewKey}.${config.dateField}`,
        operator: 'inDateRange',
        values: dateRange
      });
    }

    return query;
  };

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setErrors([]);
    const results = {};

    try {
      // Execute queries for all selected views
      const promises = selectedViews.map(async (viewKey) => {
        const config = VIEW_CONFIGS[viewKey];
        const query = buildQuery(viewKey, config);
        
        try {
          const resultSet = await cubeApi.load(query);
          return { viewKey, resultSet, config };
        } catch (error) {
          console.error(`Error loading ${viewKey}:`, error);
          setErrors(prev => [...prev, { view: viewKey, error: error.message }]);
          return null;
        }
      });

      const responses = await Promise.all(promises);

      // Process results
      responses.forEach(response => {
        if (response) {
          const { viewKey, resultSet, config } = response;
          const pivotData = resultSet.tablePivot();
          
          results[viewKey] = {
            config,
            data: pivotData,
            totals: calculateTotals(pivotData, viewKey, config.measures)
          };
        }
      });

      setData(results);
    } catch (error) {
      setErrors([{ view: 'general', error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals for measures
  const calculateTotals = (data, viewKey, measures) => {
    const totals = {};
    
    measures.forEach(measure => {
      const key = `${viewKey}.${measure}`;
      const values = data.map(row => Number(row[key] || 0));
      
      // Determine aggregation type based on measure name
      if (measure.includes('average') || measure.includes('percent') || measure.includes('percentage')) {
        // Calculate average for percentage and average metrics
        totals[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      } else {
        // Sum for all other metrics
        totals[key] = values.reduce((a, b) => a + b, 0);
      }
    });
    
    return totals;
  };

  // Load data on parameter change
  useEffect(() => {
    if (businessId && selectedViews.length > 0) {
      fetchData();
    }
  }, [businessId, dateRange[0], dateRange[1], groupBy, selectedViews.join(',')]);

  // Format value based on measure name
  const formatValue = (value, measureName) => {
    if (value === null || value === undefined) return 'N/A';
    
    if (measureName.includes('revenue') || measureName.includes('tip') || 
        measureName.includes('cash') || measureName.includes('card') ||
        measureName.includes('refund') || measureName.includes('tax') ||
        measureName.includes('fee') || measureName.includes('discount_amount') ||
        measureName.includes('sales') || measureName.includes('check_size')) {
      return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    } else if (measureName.includes('percent') || measureName.includes('percentage')) {
      return `${Number(value).toFixed(2)}%`;
    } else if (measureName.includes('time') && !measureName.includes('transaction')) {
      return `${Number(value).toFixed(0)} min`;
    } else {
      return Number(value).toLocaleString('en-US');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Advanced Period Transaction Report</h1>
      
      {/* Controls */}
      <div style={{ 
        marginBottom: '30px', 
        padding: '20px', 
        backgroundColor: 'orange',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Business ID:</label>
            <input
              type="text"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              style={{ 
                width: '100%',
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ced4da' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Start Date:</label>
            <input
              type="date"
              value={dateRange[0]}
              onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
              style={{ 
                width: '100%',
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ced4da' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>End Date:</label>
            <input
              type="date"
              value={dateRange[1]}
              onChange={(e) => setDateRange([dateRange[0], e.target.value])}
              style={{ 
                width: '100%',
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ced4da' 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Group By:</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{ 
                width: '100%',
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ced4da' 
              }}
            >
              <option value="none">No Grouping (Totals)</option>
              <option value="day">By Day</option>
              <option value="week">By Week</option>
              <option value="month">By Month</option>
            </select>
          </div>
        </div>
        
        {/* View Selection */}
        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Select Metrics:</label>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {Object.entries(VIEW_CONFIGS).map(([key, config]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedViews.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedViews([...selectedViews, key]);
                    } else {
                      setSelectedViews(selectedViews.filter(v => v !== key));
                    }
                  }}
                  style={{ marginRight: '5px' }}
                />
                {config.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading metrics...</div>
        </div>
      )}

      {/* Error Display */}
      {errors.length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px'
        }}>
          <strong>Errors:</strong>
          {errors.map((error, i) => (
            <div key={i}>{error.view}: {error.error}</div>
          ))}
        </div>
      )}

      {/* Results Display */}
      {!loading && Object.keys(data).length > 0 && (
        <div>
          {Object.entries(data).map(([viewKey, viewData]) => (
            <div key={viewKey} style={{ 
              marginBottom: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginBottom: '20px', color: '#495057' }}>
                {viewData.config.name}
              </h2>
              
              {groupBy === 'none' ? (
                // Display as metric cards for totals
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '15px'
                }}>
                  {viewData.config.measures.map(measure => {
                    const key = `${viewKey}.${measure}`;
                    const value = viewData.totals[key];
                    
                    return (
                      <div key={measure} style={{
                        padding: '15px',
                        backgroundColor: 'orange',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6c757d', 
                          marginBottom: '5px',
                          textTransform: 'capitalize'
                        }}>
                          {measure.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#212529' }}>
                          {formatValue(value, measure)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Display as table for grouped data
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'orange' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                          {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
                        </th>
                        {viewData.config.measures.map(measure => (
                          <th key={measure} style={{ 
                            padding: '10px', 
                            textAlign: 'right',
                            borderBottom: '2px solid #dee2e6',
                            fontSize: '12px'
                          }}>
                            {measure.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewData.data.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '10px', borderBottom: '1px solid #dee2e6' }}>
                            {row[Object.keys(row).find(k => k.includes('.date') || k.includes('.Date'))] || i + 1}
                          </td>
                          {viewData.config.measures.map(measure => (
                            <td key={measure} style={{ 
                              padding: '10px', 
                              textAlign: 'right',
                              borderBottom: '1px solid #dee2e6'
                            }}>
                              {formatValue(row[`${viewKey}.${measure}`], measure)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdvancedPeriodReport;