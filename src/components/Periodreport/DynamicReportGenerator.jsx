import React, { useState, useEffect } from 'react';
import cube from '@cubejs-client/core';

// Your CubeJS API configuration
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNjkzNjczNTQwfQ.HlrDsa-Vm9XCyV04ewfQhurp3eqjVeiw32NW0FIrAgE';

// Initialize CubeJS API client
const cubeApi = cube(token, {
  // apiUrl: 'https://cube.growthzilla.com/cubejs-api/v1',
  apiUrl: 'http://localhost:4000/cubejs-api/v1',
  options: {
    timezone: 'UTC'
  }
});

// Calculate totals for numeric columns
const calculateTotals = (data, reportDefinition) => {
  const totals = {};
  
  reportDefinition.forEach(column => {
    if (column.type === 'num' || column.type === 'avg') {
      const total = data.reduce((sum, row) => {
        const value = row[column.id]?.rawValue || 0;
        return sum + (isNaN(value) ? 0 : Number(value));
      }, 0);
      
      // Apply same formatting as regular cells
      let formattedTotal;
      if (column.format === 'currency') {
        formattedTotal = formatters.currency(total);
      } else if (column.format === 'percent') {
        formattedTotal = formatters.percent(total);
      } else {
        formattedTotal = formatters.number(total);
      }
      
      totals[column.id] = formattedTotal;
    } else {
      totals[column.id] = column.id === reportDefinition[0]?.id ? 'TOTAL' : '-';
    }
  });
  
  return totals;
};

const formatters = {
  currency: (value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  percent: (value) => `${Number(value).toFixed(1)}%`,
  number: (value) => Number(value).toLocaleString(),
  string: (value) => String(value),
  date: (value) => new Date(value).toLocaleDateString(),
  datetime: (value) => new Date(value).toLocaleString()
};

// Core Algorithm: Process Query and Report Definition
const processReportData = (rawData, reportDefinition) => {
  return rawData.map(row => {
    const processedRow = {};
    
    reportDefinition.forEach(column => {
      const { id, name, type, format } = column;
      const rawValue = row[id];
      
      // Apply formatting based on type and format
      let formattedValue = rawValue;
      
      if (rawValue !== null && rawValue !== undefined) {
        switch (type) {
          case 'num':
            if (format === 'currency') {
              formattedValue = formatters.currency(rawValue);
            } else if (format === 'percent') {
              formattedValue = formatters.percent(rawValue);
            } else {
              formattedValue = formatters.number(rawValue);
            }
            break;
          case 'string':
            formattedValue = formatters.string(rawValue);
            break;
          case 'avg':
            formattedValue = format === 'currency' 
              ? formatters.currency(rawValue)
              : formatters.number(rawValue);
            break;
          case 'date':
            formattedValue = formatters.date(rawValue);
            break;
          case 'datetime':
            formattedValue = formatters.datetime(rawValue);
            break;
          default:
            formattedValue = String(rawValue);
        }
      } else {
        formattedValue = '-';
      }
      
      processedRow[id] = {
        displayName: name,
        value: formattedValue,
        rawValue: rawValue
      };
    });
    
    return processedRow;
  });
};

// Table Component
const DataTable = ({ data, reportDefinition, loading, error }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
        <div className="text-gray-600">No data available</div>
      </div>
    );
  }

  // Calculate totals
  const totals = calculateTotals(data, reportDefinition);

  return (
    <div className="overflow-x-auto shadow-lg rounded-lg">
      <div className="min-w-full">
        <table className="w-full bg-white border border-gray-200">
          <thead className="bg-gray-800">
            <tr>
              {reportDefinition.map((column) => (
                <th key={column.id} className="px-3 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
                  <div className="truncate">{column.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          {/* Totals Row */}
          <tr className="bg-gray-100 border-t-2 border-gray-300">
              {reportDefinition.map((column) => (
                <td key={`total-${column.id}`} className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-gray-900">
                  <div className="truncate" title={totals[column.id]}>
                    {totals[column.id]}
                  </div>
                </td>
              ))}
            </tr>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index} className={`hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                {reportDefinition.map((column) => (
                  <td key={column.id} className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-800">
                    <div className="truncate" title={row[column.id]?.value || '-'}>
                      {row[column.id]?.value || '-'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Main Report Generator Component
const CubeJSReportGenerator = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryText, setQueryText] = useState('');
  const [reportDefText, setReportDefText] = useState('');
  const [businessId, setBusinessId] = useState('104');
  const [startDate, setStartDate] = useState('2025-05-27');
  const [endDate, setEndDate] = useState('2025-05-27');

  // Reset body styles on component mount
  useEffect(() => {
    // Store original body styles
    const originalDisplay = document.body.style.display;
    const originalMinWidth = document.body.style.minWidth;
    const originalMinHeight = document.body.style.minHeight;
    
    // Apply our styles
    document.body.style.display = 'block';
    document.body.style.minWidth = '0';
    document.body.style.minHeight = '0';
    
    // Cleanup function to restore original styles when component unmounts
    return () => {
      document.body.style.display = originalDisplay;
      document.body.style.minWidth = originalMinWidth;
      document.body.style.minHeight = originalMinHeight;
    };
  }, []);

  // Default query template with variables
  const defaultQueryTemplate = `{
  "measures": [
    "period_service_report.gross_service_sales",
    "period_service_report.net_service_sales",
    "period_service_report.service_discount",
    "period_service_report.service_quantity"
  ],
  "dimensions": [
    "period_service_report.datekey",
    "period_service_report.ServiceName"
  ],
  "filters": [
    {
      "member": "period_service_report.SaleBusinessID",
      "operator": "equals",
      "values": [businessId]
    },
    {
      "member": "period_service_report.datekey",
      "operator": "inDateRange",
      "values": [startDate, endDate]
    }
  ],
  "order": {
    "period_service_report.datekey": "asc"
  }
}`;

  const defaultReportDefinition = `[
  {
    "id": "period_service_report.datekey",
    "name": "Date",
    "type": "date",
    "format": "date"
  },
  {
    "id": "period_service_report.ServiceName",
    "name": "Service Name",
    "type": "string",
    "format": "string"
  },
  {
    "id": "period_service_report.gross_service_sales",
    "name": "Gross Sales",
    "type": "num",
    "format": "currency"
  },
  {
    "id": "period_service_report.net_service_sales",
    "name": "Net Sales",
    "type": "num",
    "format": "currency"
  },
  {
    "id": "period_service_report.service_discount",
    "name": "Discount",
    "type": "num",
    "format": "currency"
  },
  {
    "id": "period_service_report.service_quantity",
    "name": "Quantity",
    "type": "num",
    "format": "number"
  }
]`;

  // Function to replace template variables with actual values
  const replaceTemplateVariables = (queryString) => {
    // Create a clean version without comments for parsing
    let cleanQuery = queryString
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Replace template variables with actual values
    // Using a function to dynamically evaluate the variables
    const replacer = (match, variableName) => {
      switch(variableName) {
        case 'businessId':
          return `"${businessId}"`;
        case 'startDate':
          return `"${startDate}"`;
        case 'endDate':
          return `"${endDate}"`;
        default:
          return match;
      }
    };
    
    // Replace unquoted variables (e.g., businessId, startDate, endDate)
    cleanQuery = cleanQuery.replace(/\b(businessId|startDate|endDate)\b(?!["'])/g, replacer);
    
    return cleanQuery;
  };

  const loadDefaultQuery = () => {
    setQueryText(defaultQueryTemplate);
    setReportDefText(defaultReportDefinition);
  };

  // Core Algorithm: Fetch and Process Data
  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      // Parse manual input
      if (!queryText.trim() || !reportDefText.trim()) {
        throw new Error('Please provide both query and report definition');
      }

      let activeQuery, activeReportDef;
      
      try {
        // Replace template variables in the query
        const processedQuery = replaceTemplateVariables(queryText);
        
        console.log('Query with replaced variables:', processedQuery);
        
        // Parse the processed query
        activeQuery = JSON.parse(processedQuery);
        activeReportDef = JSON.parse(reportDefText);
      } catch (parseErr) {
        throw new Error(`JSON parsing error: ${parseErr.message}. Make sure your JSON is valid and variables are properly formatted.`);
      }

      // Validate query
      if (!activeQuery.measures || activeQuery.measures.length === 0) {
        throw new Error('Query must contain at least one measure');
      }

      if (!activeReportDef || activeReportDef.length === 0) {
        throw new Error('Report definition must contain at least one column');
      }

      console.log('Fetching data from CubeJS with query:', activeQuery);
      
      // Step 1: Fetch data from CubeJS
      const result = await cubeApi.load(activeQuery);
      
      console.log('CubeJS response:', result);
      console.log('Raw data from CubeJS:', result.rawData());
      
      // Step 2: Extract data from ResultSet - CubeJS returns a ResultSet object
      const rawData = result.rawData();
      
      if (!rawData || rawData.length === 0) {
        console.log('No data returned from CubeJS');
        setData([]);
        return;
      }
      
      // Step 3: Process data with report definition
      const processedData = processReportData(rawData, activeReportDef);
      
      // Step 4: Set processed data
      setData(processedData);
      
    } catch (err) {
      console.error('Report generation failed:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
      <div className="max-w-screen-2xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dynamic Report Generator</h1>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={loadDefaultQuery}
              className="px-4 sm:px-6 py-3 bg-gray-500 text-grey font-semibold rounded-lg hover:bg-gray-600 shadow-md transition-colors duration-200 text-sm sm:text-base"
            >
              Load Template Query
            </button>
            <button
              onClick={generateReport}
              disabled={loading}
              className="px-4 sm:px-6 py-3 bg-blue-600 text-grey font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-colors duration-200 text-sm sm:text-base"
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Report Configuration</h2>
          
          {/* Parameter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Business ID:</label>
              <input
                type="text"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter Business ID"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Template Variables Info */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>💡 Tip:</strong> Use these variables in your query: <code className="bg-gray-100 px-1 rounded">businessId</code>, <code className="bg-gray-100 px-1 rounded">startDate</code>, <code className="bg-gray-100 px-1 rounded">endDate</code>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Example: <code className="bg-gray-100 px-1 rounded">"values": [businessId]</code> will be replaced with <code className="bg-gray-100 px-1 rounded">"values": ["{businessId}"]</code>
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h3 className="font-semibold mb-2 text-gray-700 text-sm sm:text-base">CubeJS Query (with template variables):</h3>
              <textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder={`{
  "measures": ["your_cube.measure"],
  "dimensions": ["your_cube.dimension"],
  "filters": [
    {
      "member": "your_cube.BusinessID",
      "operator": "equals",
      "values": [businessId]
    },
    {
      "member": "your_cube.datekey",
      "operator": "inDateRange",
      "values": [startDate, endDate]
    }
  ]
}`}
                className="w-full h-48 sm:h-64 p-3 sm:p-4 border border-gray-300 rounded-lg text-xs font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-gray-700 text-sm sm:text-base">Report Definition (JSON):</h3>
              <textarea
                value={reportDefText}
                onChange={(e) => setReportDefText(e.target.value)}
                placeholder={`[
  {
    "id": "your_cube.measure1",
    "name": "Display Name",
    "type": "num",
    "format": "currency"
  },
  {
    "id": "your_cube.dimension1",
    "name": "Category",
    "type": "string",
    "format": "string"
  }
]`}
                className="w-full h-48 sm:h-64 p-3 sm:p-4 border border-gray-300 rounded-lg text-xs font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 text-xs sm:text-sm text-gray-600">
            <p><strong>Supported formats:</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1 sm:gap-2 mt-1">
              <span><strong>currency:</strong> $1,234.56</span>
              <span><strong>number:</strong> 1,234</span>
              <span><strong>percent:</strong> 12.5%</span>
              <span><strong>date:</strong> MM/DD/YYYY</span>
              <span><strong>string:</strong> Plain text</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Report Results</h2>
          <DataTable
            data={data}
            reportDefinition={reportDefText ? JSON.parse(reportDefText || '[]') : []}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
};

export default CubeJSReportGenerator;