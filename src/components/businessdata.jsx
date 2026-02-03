import React, { useState } from 'react';
import cubejs from '@cubejs-client/core';

// Initialize Cube.js API
const cubejsApi = cubejs('YOUR_TOKEN', {
  apiUrl: 'http://localhost:4000/cubejs-api/v1'
});

const TestComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await cubejsApi.load({
        measures: ['business_sales.gross_revenue'],
        dimensions: ['business_sales.SalesBusinessName'],
        filters: [
          {
            member: 'business_sales.SalesBusinessID',
            operator: 'equals',
            values: ['104']
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
      <button onClick={fetchData}>
        {loading ? 'Loading...' : 'Test Cube.js'}
      </button>
      
      {data && (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
};

export default TestComponent;