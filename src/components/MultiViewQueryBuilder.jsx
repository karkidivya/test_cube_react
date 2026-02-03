// components/SimpleQueryBuilderTable.jsx
import React, { useState, useEffect, useRef } from 'react';
import { QueryBuilder } from '@cubejs-client/react';
import { cubeApi } from '../config/cube';

// Component for each view's QueryBuilder
function ViewQueryBuilder({ view, measures, businessId, dateRange, onDataReceived }) {
  const lastResultRef = useRef(null);
  
  const buildQuery = () => {
    const query = {
      measures: measures.map(m => `${view}.${m}`),
      dimensions: [],
      filters: []
    };

    // Add appropriate dimensions and filters based on view
    if (view === 'period_transaction_report_sales') {
      query.dimensions = [
        'period_transaction_report_sales.TransactionDate',
        'period_transaction_report_sales.SalesBusinessID'
      ];
      query.filters = [
        {
          member: 'period_transaction_report_sales.SalesBusinessID',
          operator: 'equals',
          values: [businessId]
        },
        {
          member: 'period_transaction_report_sales.TransactionDate',
          operator: 'inDateRange',
          values: dateRange
        }
      ];
    } else if (view === 'period_transaction_report_appt') {
      query.dimensions = [
        'period_transaction_report_appt.AppointmentDay',
        'period_transaction_report_appt.AppointmentBusinessId'
      ];
      query.filters = [
        {
          member: 'period_transaction_report_appt.AppointmentBusinessId',
          operator: 'equals',
          values: [businessId]
        },
        {
          member: 'period_transaction_report_appt.AppointmentDay',
          operator: 'inDateRange',
          values: dateRange
        }
      ];
    } else if (view === 'period_transaction_report_servicequeue') {
      query.dimensions = [
        'period_transaction_report_servicequeue.ServiceQueueTransactionDate',
        'period_transaction_report_servicequeue.ServiceQueuueBusinessID'
      ];
      query.filters = [
        {
          member: 'period_transaction_report_servicequeue.ServiceQueuueBusinessID',
          operator: 'equals',
          values: [businessId]
        },
        {
          member: 'period_transaction_report_servicequeue.ServiceQueueTransactionDate',
          operator: 'inDateRange',
          values: dateRange
        }
      ];
    } else if (view === 'period_transaction_report_phone') {
      query.dimensions = ['period_transaction_report_phone.TextBusinessID'];
      query.filters = [
        {
          member: 'period_transaction_report_phone.TextBusinessID',
          operator: 'equals',
          values: [businessId]
        }
      ];
    }

    return query;
  };

  return (
    <QueryBuilder
      query={buildQuery()}
      cubeApi={cubeApi}
      render={({ resultSet, loading, error }) => {
        // Handle data updates without hooks
        if (resultSet && !loading) {
          const currentData = resultSet.tablePivot();
          const currentDataStr = JSON.stringify(currentData);
          
          if (lastResultRef.current !== currentDataStr) {
            lastResultRef.current = currentDataStr;
            onDataReceived(view, currentData);
          }
        }

        if (error) {
          console.error(`Error in ${view}:`, error);
        }

        return null; // This component doesn't render anything
      }}
    />
  );
}

function SimpleQueryBuilderTable() {
  const [businessId, setBusinessId] = useState('104');
  const [dateRange, setDateRange] = useState(['2025-05-24', '2025-05-27']);
  const [allData, setAllData] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Define measures for each view
  const viewMeasures = {
    'period_transaction_report_sales': [
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
    ],
    'period_transaction_report_appt': [
      'appointment_sales',
      'appointments_created_in_period',
      'appointments_scheduled_for_period',
      'total_cancelled_appointments'
    ],
    'period_transaction_report_servicequeue': [
      'appointments',
      'average_service_time',
      'total_cancelled_service',
      'deleted_before_service',
      'deleted_after_service'
    ],
    'period_transaction_report_phone': [
      'Unsubscribed'
    ]
  };

  // Handle data from each view
  const handleDataReceived = (view, data) => {
    setAllData(prev => {
      const newData = { ...prev, [view]: data };
      
      // Check if we have all views
      const views = Object.keys(viewMeasures);
      const receivedViews = Object.keys(newData);
      
      if (receivedViews.length === views.length) {
        setIsLoading(false);
      }
      
      return newData;
    });
  };

  // Combine data when all views have reported
  useEffect(() => {
    const views = Object.keys(viewMeasures);
    const receivedViews = Object.keys(allData);
    
    if (receivedViews.length === views.length) {
      // Get sales data as base
      const salesData = allData['period_transaction_report_sales'] || [];
      
      // Create lookup maps for other views
      const apptMap = new Map();
      (allData['period_transaction_report_appt'] || []).forEach(row => {
        const date = row['period_transaction_report_appt.AppointmentDay'];
        apptMap.set(date, row);
      });

      const serviceQueueMap = new Map();
      (allData['period_transaction_report_servicequeue'] || []).forEach(row => {
        const date = row['period_transaction_report_servicequeue.ServiceQueueTransactionDate'];
        serviceQueueMap.set(date, row);
      });

      const phoneData = (allData['period_transaction_report_phone'] || [])[0] || {};

      // Combine all data
      const combined = salesData.map(salesRow => {
        const date = salesRow['period_transaction_report_sales.TransactionDate'];
        const apptRow = apptMap.get(date) || {};
        const serviceQueueRow = serviceQueueMap.get(date) || {};

        return {
          date,
          businessId,
          ...salesRow,
          ...apptRow,
          ...serviceQueueRow,
          'period_transaction_report_phone.Unsubscribed': phoneData['period_transaction_report_phone.Unsubscribed']
        };
      });

      setCombinedData(combined);
    }
  }, [allData]);

  // Reset when parameters change
  useEffect(() => {
    setAllData({});
    setIsLoading(true);
    setCombinedData([]);
  }, [businessId, dateRange[0], dateRange[1]]);

  // Format value helper
  const formatValue = (value, key) => {
    if (value === null || value === undefined) return '0';
    
    const numValue = Number(value);
    
    if (key.includes('revenue') || key.includes('sales') || key.includes('tip') || 
        key.includes('cash') || key.includes('card') || key.includes('refund') || 
        key.includes('tax') || key.includes('fee') || key.includes('discount_amount') ||
        key.includes('check_size') || key.includes('cashback') || key.includes('gift')) {
      return `$${numValue.toFixed(2)}`;
    } else if (key.includes('percent') || key.includes('percentage')) {
      return `${numValue.toFixed(2)}%`;
    } else if (key.includes('time')) {
      return `${numValue.toFixed(0)} min`;
    } else {
      return numValue.toFixed(0);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>All Metrics Table</h1>
      
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

      {/* Hidden QueryBuilders */}
      {Object.entries(viewMeasures).map(([view, measures]) => (
        <ViewQueryBuilder
          key={view}
          view={view}
          measures={measures}
          businessId={businessId}
          dateRange={dateRange}
          onDataReceived={handleDataReceived}
        />
      ))}

      {/* Loading State */}
      {isLoading && (
        <div>Loading data from all views...</div>
      )}

      {/* Results Table */}
      {!isLoading && combinedData.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table border="1" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: 'yellow', zIndex: 1 }}>Date</th>
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
                <th style={{ padding: '8px', backgroundColor: 'red' }}>Appt Sales</th>
                <th style={{ padding: '8px', backgroundColor: 'red' }}>Appt Created</th>
                <th style={{ padding: '8px', backgroundColor: 'red' }}>Appt Scheduled</th>
                <th style={{ padding: '8px', backgroundColor: 'red' }}>Appt Cancelled</th>
                {/* Service Queue Metrics */}
                <th style={{ padding: '8px', backgroundColor: 'green' }}>Appointments</th>
                <th style={{ padding: '8px', backgroundColor: 'green' }}>Avg Service Time</th>
                <th style={{ padding: '8px', backgroundColor: 'green' }}>Cancellation Loss</th>
                <th style={{ padding: '8px', backgroundColor: 'green' }}>Deleted Before</th>
                <th style={{ padding: '8px', backgroundColor: 'green' }}>Deleted After</th>
                {/* Phone Metrics */}
                <th style={{ padding: '8px', backgroundColor: 'blue' }}>Unsubscribed</th>
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
                  <td style={{ padding: '8px', textAlign: 'right' }}>{formatValue(row['period_transaction_report_sales.gross_gift_redeemeption'], 'gift')}</td>
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
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'blue' }}>{formatValue(row['period_transaction_report_appt.appointment_sales'], 'sales')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'blue' }}>{formatValue(row['period_transaction_report_appt.appointments_created_in_period'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'blue' }}>{formatValue(row['period_transaction_report_appt.appointments_scheduled_for_period'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'blue' }}>{formatValue(row['period_transaction_report_appt.total_cancelled_appointments'], 'count')}</td>
                  {/* Service Queue Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'red' }}>{formatValue(row['period_transaction_report_servicequeue.appointments'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'red' }}>{formatValue(row['period_transaction_report_servicequeue.average_service_time'], 'time')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'red' }}>{formatValue(row['period_transaction_report_servicequeue.total_cancelled_service'], 'revenue')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'red' }}>{formatValue(row['period_transaction_report_servicequeue.deleted_before_service'], 'count')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: 'red' }}>{formatValue(row['period_transaction_report_servicequeue.deleted_after_service'], 'count')}</td>
                  {/* Phone Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0fff0' }}>{formatValue(row['period_transaction_report_phone.Unsubscribed'], 'count')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && combinedData.length === 0 && (
        <div>No data found for the selected criteria.</div>
      )}
    </div>
  );
}

export default SimpleQueryBuilderTable;