// components/StaffPeriodReportTable.jsx
import React, { useState, useEffect } from 'react';
import { cubeApi } from '../../config/cube';

// View configurations for staff report
const VIEW_CONFIGS = {
  Date_key: {
    name: 'Date Dimension',
    dateField: 'datekey',
    measures: [] // No measures, just dates
  },
  staff_report_view: {
    name: 'Staff Sales Metrics',
    businessIdField: 'SaleBusinessID',
    employeeIdField: 'EmployeeId',
    dateField: 'TransactionDate',
    measures: [
      'prepaid_quantity',                // 7. Staff Prepaid Qty
      'gross_employee_prepaid_sales',    // 8. Staff prepaid sales (After)
      'net_employee_prepaid_sales',      // 9. Staff prepaid sales (Before)
      'product_quantity',                // 10. Staff Retail Qty
      'net_employee_product_sales',      // 11. Staff Retail Sales (After)
      'gross_employee_product_sales',    // 12. Staff Retail Sales (Before)
      'service_quantity',                // 13. Staff Service Qty
      'net_employee_service_sales',      // 14. Staff service sales (After)
      'gross_employee_service_sales',    // 15. Staff service sales (Before)
      'net_employee_sales',              // 17. Staff Total Sales (After)
      'gross_employee_sales'             // 18. Staff Total Sales (Before)
    ],
    dimensions: [
      'EmployeeFullName',                // 2. Staff Name
      'EmployeeId'
    ]
  },
  staff_report_view_timesheets: {
    name: 'Timesheet Metrics',
    businessIdField: 'TimesheetEmployeeBusinessId',
    employeeIdField: 'TimesheetEmployeeID',
    dateField: 'Period',
    measures: [
      'HoursLogged'                      // 5. Hours Logged
    ]
  },
  staff_report_view_queues: {
    name: 'Queue Metrics',
    businessIdField: 'SalesBusinessID',
    employeeIdField: 'SalesEmployeeID',
    dateField: 'TransactionDate',
    measures: [
      'serviced_queue',                  // 6. Serviced Queues
      'serviced_appointment'             // 3. Appointment Customers
    ]
  }
};

function StaffPeriodReportTable() {
  const [businessId, setBusinessId] = useState('104');
  const [employeeId, setEmployeeId] = useState(''); // Optional employee filter
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

    // Add dimensions from config
    if (config.dimensions) {
      config.dimensions.forEach(dim => {
        query.dimensions.push(`${viewKey}.${dim}`);
      });
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

    // Add employee ID filter if specified
    if (config.employeeIdField && employeeId) {
      query.filters.push({
        member: `${viewKey}.${config.employeeIdField}`,
        operator: 'equals',
        values: [employeeId]
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

      // Combine all data by date and employee
      const dataByView = {};
      responses.forEach(({ viewKey, data, config }) => {
        dataByView[viewKey] = { data, config };
      });

      // Get all dates from Date_key view
      const allDates = (dataByView['Date_key']?.data || []).map(row => 
        row['Date_key.datekey']
      );

      // Get unique employees from staff_report_view
      const employeesMap = new Map();
      (dataByView['staff_report_view']?.data || []).forEach(row => {
        const empId = row['staff_report_view.EmployeeId'];
        const empName = row['staff_report_view.EmployeeFullName'];
        if (empId && !employeesMap.has(empId)) {
          employeesMap.set(empId, empName);
        }
      });

      // Create lookup maps for each view by date and employee
      const staffSalesMap = new Map();
      (dataByView['staff_report_view']?.data || []).forEach(row => {
        const date = row['staff_report_view.TransactionDate'];
        const empId = row['staff_report_view.EmployeeId'];
        const key = `${date}_${empId}`;
        staffSalesMap.set(key, row);
      });

      const timesheetMap = new Map();
      (dataByView['staff_report_view_timesheets']?.data || []).forEach(row => {
        const date = row['staff_report_view_timesheets.Period'];
        const empId = row['staff_report_view_timesheets.TimesheetEmployeeID'];
        const key = `${date}_${empId}`;
        timesheetMap.set(key, row);
      });

      const queueMap = new Map();
      (dataByView['staff_report_view_queues']?.data || []).forEach(row => {
        const date = row['staff_report_view_queues.TransactionDate'];
        const empId = row['staff_report_view_queues.SalesEmployeeID'];
        const key = `${date}_${empId}`;
        queueMap.set(key, row);
      });

      // Create empty row template with all metrics set to 0
      const createEmptyRow = () => {
        const emptyRow = {};
        
        // Staff sales metrics
        VIEW_CONFIGS.staff_report_view.measures.forEach(measure => {
          emptyRow[`staff_report_view.${measure}`] = 0;
        });
        
        // Timesheet metrics
        VIEW_CONFIGS.staff_report_view_timesheets.measures.forEach(measure => {
          emptyRow[`staff_report_view_timesheets.${measure}`] = 0;
        });
        
        // Queue metrics
        VIEW_CONFIGS.staff_report_view_queues.measures.forEach(measure => {
          emptyRow[`staff_report_view_queues.${measure}`] = 0;
        });
        
        return emptyRow;
      };

      // Combine all data using Date_key dates and employees
      const combined = [];
      
      allDates.forEach(date => {
        // If no specific employee filter, show all employees
        if (!employeeId) {
          employeesMap.forEach((empName, empId) => {
            const key = `${date}_${empId}`;
            const staffSalesRow = staffSalesMap.get(key) || {};
            const timesheetRow = timesheetMap.get(key) || {};
            const queueRow = queueMap.get(key) || {};
            
            // Start with empty row (all zeros)
            const emptyRow = createEmptyRow();

            // Create combined row with all metrics
            const combinedRow = {
              date,
              businessId,
              employeeId: empId,
              employeeName: empName,
              ...emptyRow, // First set all values to 0
              ...staffSalesRow, // Then override with actual values if they exist
              ...timesheetRow,
              ...queueRow
            };

            combined.push(combinedRow);
          });
        } else {
          // Single employee filter
          const key = `${date}_${employeeId}`;
          const staffSalesRow = staffSalesMap.get(key) || {};
          const timesheetRow = timesheetMap.get(key) || {};
          const queueRow = queueMap.get(key) || {};
          
          const emptyRow = createEmptyRow();
          const empName = employeesMap.get(employeeId) || 'Unknown';

          const combinedRow = {
            date,
            businessId,
            employeeId,
            employeeName: empName,
            ...emptyRow,
            ...staffSalesRow,
            ...timesheetRow,
            ...queueRow
          };

          combined.push(combinedRow);
        }
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
  }, [businessId, employeeId, dateRange[0], dateRange[1]]);

  // Format value based on measure name
  const formatValue = (value, measureName) => {
    if (value === null || value === undefined) return '0';
    
    const numValue = Number(value);
    
    if (measureName.includes('sales') || measureName.includes('revenue')) {
      return `$${numValue.toFixed(2)}`;
    } else if (measureName.includes('quantity') || measureName.includes('queue') || 
               measureName.includes('appointment')) {
      return numValue.toFixed(0);
    } else if (measureName.includes('hours')) {
      return `${numValue.toFixed(2)} hrs`;
    } else {
      return numValue.toFixed(0);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Staff Period Report</h1>
      
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
          type="text"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          placeholder="Employee ID (optional)"
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
      {loading && <div>Loading staff metrics...</div>}

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
                <th style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: '#f5f5f5', zIndex: 2 }}>Date</th>
                <th style={{ padding: '8px', position: 'sticky', left: 80, backgroundColor: '#f5f5f5', zIndex: 2 }}>Employee Name</th>
                <th style={{ padding: '8px' }}>Employee ID</th>
                <th style={{ padding: '8px' }}>Business ID</th>
                
                {/* Queue Metrics */}
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Appointment Customers</th>
                <th style={{ padding: '8px', backgroundColor: '#e6f3ff' }}>Serviced Queues</th>
                
                {/* Timesheet Metrics */}
                <th style={{ padding: '8px', backgroundColor: '#f0fff0' }}>Hours Logged</th>
                
                {/* Staff Sales Metrics */}
                <th style={{ padding: '8px' }}>Prepaid Qty</th>
                <th style={{ padding: '8px' }}>Prepaid Sales (After)</th>
                <th style={{ padding: '8px' }}>Prepaid Sales (Before)</th>
                <th style={{ padding: '8px' }}>Retail Qty</th>
                <th style={{ padding: '8px' }}>Retail Sales (After)</th>
                <th style={{ padding: '8px' }}>Retail Sales (Before)</th>
                <th style={{ padding: '8px' }}>Service Qty</th>
                <th style={{ padding: '8px' }}>Service Sales (After)</th>
                <th style={{ padding: '8px' }}>Service Sales (Before)</th>
                <th style={{ padding: '8px' }}>Total Sales (After)</th>
                <th style={{ padding: '8px' }}>Total Sales (Before)</th>
              </tr>
            </thead>
            <tbody>
              {combinedData.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>{row.date}</td>
                  <td style={{ padding: '8px', position: 'sticky', left: 80, backgroundColor: 'white', zIndex: 1 }}>{row.employeeName}</td>
                  <td style={{ padding: '8px' }}>{row.employeeId}</td>
                  <td style={{ padding: '8px' }}>{row.businessId}</td>
                  
                  {/* Queue Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>
                    {formatValue(row['staff_report_view_queues.serviced_appointment'], 'appointment')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>
                    {formatValue(row['staff_report_view_queues.serviced_queue'], 'queue')}
                  </td>
                  
                  {/* Timesheet Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right', backgroundColor: '#f5fff5' }}>
                    {formatValue(row['staff_report_view_timesheets.HoursLogged'], 'hours')}
                  </td>
                  
                  {/* Staff Sales Metrics */}
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.prepaid_quantity'], 'quantity')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.gross_employee_prepaid_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.net_employee_prepaid_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.product_quantity'], 'quantity')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.net_employee_product_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.gross_employee_product_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.service_quantity'], 'quantity')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.net_employee_service_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {formatValue(row['staff_report_view.gross_employee_service_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatValue(row['staff_report_view.net_employee_sales'], 'sales')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatValue(row['staff_report_view.gross_employee_sales'], 'sales')}
                  </td>
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

export default StaffPeriodReportTable;