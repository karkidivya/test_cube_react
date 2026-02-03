// components/SimplePeriodReportTable.jsx
import React, { useState, useEffect } from 'react';
import { cubeApi } from '../../config/cube';

// View configurations with their specific filters
const VIEW_CONFIGS = {
  Date_key: {
    name: 'Date Dimension',
    dateField: 'datekey',
    measures: [] // No measures, just dates
  },
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
    dateField: 'TextUnsubscribedAt', // Updated date field
    measures: ['Unsubscribed']
  }
};

function TransactionReportTable() {
  const [businessId, setBusinessId] = useState('104');
  const [dateRange, setDateRange] = useState(['2025-05-24', '2025-05-27']);
  const [combinedData, setCombinedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  // Convert date to UTC format
  const toUTCDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Build queries for each view
  const buildQuery = (viewKey, config) => {
    const query = {
      measures: config.measures
        .filter(m => m !== undefined)
        .map(m => `${viewKey}.${m}`),
      dimensions: [],
      filters: [],
      timezone: 'UTC'
    };

    // Special handling for Date_key view
    if (viewKey === 'Date_key') {
      query.dimensions.push('Date_key.datekey');
      query.filters.push({
        member: 'Date_key.datekey',
        operator: 'inDateRange',
        values: [
          toUTCDate(dateRange[0]),
          toUTCDate(dateRange[1])
        ]
      });
      return query;
    }

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
      query.dimensions.push(`${viewKey}.${config.dateField}`);
      query.filters.push({
        member: `${viewKey}.${config.dateField}`,
        operator: 'inDateRange',
        values: [
          toUTCDate(dateRange[0]),
          toUTCDate(dateRange[1])
        ]
      });
    }

    return query;
  };

  // Fetch all data and combine into single table
  const fetchData = async () => {
    setLoading(true);
    setErrors([]);

    try {
      // Execute queries for all views
      const promises = Object.entries(VIEW_CONFIGS).map(async ([viewKey, config]) => {
        const query = buildQuery(viewKey, config);
        
        try {
          const resultSet = await cubeApi.load(query);
          return { viewKey, data: resultSet.tablePivot(), config };
        } catch (error) {
          console.error(`Error loading ${viewKey}:`, error);
          setErrors(prev => [...prev, { view: viewKey, error: error.message }]);
          return { viewKey, data: [], config };
        }
      });

      const responses = await Promise.all(promises);

      // Combine all data by date
      const dataByView = {};
      responses.forEach(({ viewKey, data, config }) => {
        dataByView[viewKey] = { data, config };
      });

      // Get all dates from Date_key view
      const allDates = (dataByView['Date_key']?.data || []).map(row => 
        row['Date_key.datekey']
      );

      // Create lookup maps for each view
      const salesMap = new Map();
      (dataByView['period_transaction_report_sales']?.data || []).forEach(row => {
        const date = row['period_transaction_report_sales.TransactionDate'];
        salesMap.set(date, row);
      });

      const apptMap = new Map();
      (dataByView['period_transaction_report_appt']?.data || []).forEach(row => {
        const date = row['period_transaction_report_appt.AppointmentDay'];
        apptMap.set(date, row);
      });

      const serviceQueueMap = new Map();
      (dataByView['period_transaction_report_servicequeue']?.data || []).forEach(row => {
        const date = row['period_transaction_report_servicequeue.ServiceQueueTransactionDate'];
        serviceQueueMap.set(date, row);
      });

      const phoneMap = new Map();
      (dataByView['period_transaction_report_phone']?.data || []).forEach(row => {
        const date = row['period_transaction_report_phone.TextUnsubscribedAt'];
        phoneMap.set(date, row);
      });

      // Create empty row template with all metrics set to 0
      const createEmptyRow = () => {
        const emptyRow = {};
        
        // Sales metrics
        VIEW_CONFIGS.period_transaction_report_sales.measures.forEach(measure => {
          emptyRow[`period_transaction_report_sales.${measure}`] = 0;
        });
        
        // Appointment metrics
        VIEW_CONFIGS.period_transaction_report_appt.measures.forEach(measure => {
          emptyRow[`period_transaction_report_appt.${measure}`] = 0;
        });
        
        // Service Queue metrics
        VIEW_CONFIGS.period_transaction_report_servicequeue.measures.forEach(measure => {
          emptyRow[`period_transaction_report_servicequeue.${measure}`] = 0;
        });
        
        // Phone metrics
        VIEW_CONFIGS.period_transaction_report_phone.measures.forEach(measure => {
          emptyRow[`period_transaction_report_phone.${measure}`] = 0;
        });
        
        return emptyRow;
      };

      // Combine all data using Date_key dates
      const combined = allDates.map(date => {
        const salesRow = salesMap.get(date) || {};
        const apptRow = apptMap.get(date) || {};
        const serviceQueueRow = serviceQueueMap.get(date) || {};
        const phoneRow = phoneMap.get(date) || {};
        
        // Start with empty row (all zeros)
        const emptyRow = createEmptyRow();

        // Create combined row with all metrics
        const combinedRow = {
          date,
          businessId,
          ...emptyRow, // First set all values to 0
          ...salesRow, // Then override with actual values if they exist
          ...apptRow,
          ...serviceQueueRow,
          ...phoneRow
        };

        return combinedRow;
      });

      setCombinedData(combined);
    } catch (error) {
      setErrors([{ view: 'general', error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on parameter change
  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, dateRange[0], dateRange[1]]);

  // Format value based on measure name
  const formatValue = (value, measureName) => {
    if (value === null || value === undefined) return '0';
    
    const numValue = Number(value);
    
    if (measureName.includes('revenue') || measureName.includes('tip') || 
        measureName.includes('cash') || measureName.includes('card') ||
        measureName.includes('refund') || measureName.includes('tax') ||
        measureName.includes('fee') || measureName.includes('discount_amount') ||
        measureName.includes('sales') || measureName.includes('check_size') ||
        measureName.includes('cashback') || measureName.includes('gift')) {
      return `$${numValue.toFixed(2)}`;
    } else if (measureName.includes('percent') || measureName.includes('percentage')) {
      return `${numValue.toFixed(2)}%`;
    } else if (measureName.includes('time')) {
      return `${numValue.toFixed(0)} min`;
    } else {
      return numValue.toFixed(0);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Period Transaction Report - All Metrics</h1>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
          placeholder="Business ID"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="date"
          value={dateRange[0]}
          onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <input
          type="date"
          value={dateRange[1]}
          onChange={(e) => setDateRange([dateRange[0], e.target.value])}
          style={{ padding: '5px' }}
        />
      </div>

      {/* Loading State */}
      {loading && <div>Loading metrics...</div>}

      {/* Error Display */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '20px', color: 'red' }}>
          <strong>Errors:</strong>
          {errors.map((error, i) => (
            <div key={i}>{error.view}: {error.error}</div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {!loading && combinedData.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table border="1" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: '#f5f5f5', zIndex: 1 }}>Date</th>
                <th style={{ padding: '8px' }}>Business ID</th>
                {/* Sales Metrics */}
                <th style={{ padding: '8px' }}>Transactions</th>
                <th style={{ padding: '8px' }}>Revenue</th>
                <th style={{ padding: '8px' }}>Cash Revenue</th>
                <th style={{ padding: '8px' }}>Credit Revenue</th>
                <th style={{ padding: '8px' }}>Avg Check Size</th>
                <th style={{ padding: '8px' }}>Appointments %</th>
                <th style={{ padding: '8px' }}>Avg Visit Duration</th>
                <th style={{ padding: '8px' }}>Avg Visit Duration 22</th>
                <th style={{ padding: '8px' }}>Avg Wait Time</th>
                <th style={{ padding: '8px' }}>Avg Wait Time (Cancelled)</th>
                <th style={{ padding: '8px' }}>Card Tips</th>
                <th style={{ padding: '8px' }}>Cash %</th>
                <th style={{ padding: '8px' }}>Cash Tips</th>
                <th style={{ padding: '8px' }}>Cashback</th>
                <th style={{ padding: '8px' }}>Credit %</th>
                <th style={{ padding: '8px' }}>Discount</th>
                <th style={{ padding: '8px' }}>Discount %</th>
                <th style={{ padding: '8px' }}>Fees</th>
                <th style={{ padding: '8px' }}>Gift Redeemed</th>
                <th style={{ padding: '8px' }}>Gross Cash</th>
                <th style={{ padding: '8px' }}>Gross Credit</th>
                <th style={{ padding: '8px' }}>Gross Revenue</th>
                <th style={{ padding: '8px' }}>Refund</th>
                <th style={{ padding: '8px' }}>Cash Refund</th>
                <th style={{ padding: '8px' }}>Card Refund</th>
                <th style={{ padding: '8px' }}>New Customers</th>
                <th style={{ padding: '8px' }}>New Customers %</th>
                <th style={{ padding: '8px' }}>Repeat Customers</th>
                <th style={{ padding: '8px' }}>Repeat Customers %</th>
                <th style={{ padding: '8px' }}>Total Tip</th>
                <th style={{ padding: '8px' }}>Tax</th>
                <th style={{ padding: '8px' }}>Walk-ins</th>
                {/* Appointment Metrics */}
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Appt Sales</th>
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Appt Created</th>
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Appt Scheduled</th>
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Appt Cancelled</th>
                {/* Service Queue Metrics */}
                <th style={{ padding: '8px', backgroundColor: '#ffe6e6' }}>Appointments</th>
                <th style={{ padding: '8px', backgroundColor: '#ffe6e6' }}>Avg Service Time</th>
                <th style={{ padding: '8px', backgroundColor: '#ffe6e6' }}>Cancellation Loss</th>
                <th style={{ padding: '8px', backgroundColor: '#ffe6e6' }}>Deleted Before</th>
                <th style={{ padding: '8px', backgroundColor: '#ffe6e6' }}>Deleted After</th>
                {/* Phone Metrics */}
                <th style={{ padding: '8px', backgroundColor: '#e6ffe6' }}>Unsubscribed</th>
              </tr>
            </thead>
            <tbody>
              {combinedData.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>{row.date}</td>
                  <td style={{ padding: '8px' }}>{row.businessId}</td>
                  {/* Sales Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.total_transactions'], 'transactions')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.net_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.net_cash_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.net_card_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.avg_net_check_size'], 'check_size')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.appointment_transaction_percentage'], 'percentage')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.average_time_per_transaction'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.average_time_per_transaction_22'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.average_wait_time_of_complete_transactions'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.average_wait_time_of_cancelled_transactions'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_card_tip'], 'tip')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.cash_percent'], 'percent')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_cash_tip'], 'tip')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_cashback'], 'cashback')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.credit_percent'], 'percent')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.discount_amount'], 'discount_amount')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.discount_percentage_of_net'], 'percentage')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_fees'], 'fee')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_gift_redeemption'], 'gift')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_cash_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_card_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_revenue'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.total_refund'], 'refund')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.cash_refund'], 'refund')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.card_refund'], 'refund')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.new_visits'], 'visits')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.new_visits_percentage'], 'percentage')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.repeat_visits'], 'visits')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.repeat_visits_percentage'], 'percentage')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_tip'], 'tip')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_tax'], 'tax')}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.walkin_transaction'], 'transactions')}</td>
                  {/* Appointment Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>{formatValue(row['period_transaction_report_appt.appointment_sales'], 'sales')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>{formatValue(row['period_transaction_report_appt.appointments_created_in_period'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>{formatValue(row['period_transaction_report_appt.appointments_scheduled_for_period'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>{formatValue(row['period_transaction_report_appt.total_cancelled_appointments'], 'count')}</td>
                  {/* Service Queue Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#fff0f0' }}>{formatValue(row['period_transaction_report_servicequeue.appointments'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#fff0f0' }}>{formatValue(row['period_transaction_report_servicequeue.average_service_time'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#fff0f0' }}>{formatValue(row['period_transaction_report_servicequeue.total_cancelled_service'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#fff0f0' }}>{formatValue(row['period_transaction_report_servicequeue.deleted_before_service'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#fff0f0' }}>{formatValue(row['period_transaction_report_servicequeue.deleted_after_service'], 'count')}</td>
                  {/* Phone Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0fff0' }}>{formatValue(row['period_transaction_report_phone.Unsubscribed'], 'count')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && combinedData.length === 0 && (
        <div>No data found for the selected criteria.</div>
      )}
    </div>
  );
}

export default TransactionReportTable;