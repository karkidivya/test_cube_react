// src/components/CustomQueryBuilder.jsx
import { useState, useEffect } from 'react';
import { useCubeQuery } from '@cubejs-client/react';
import cubejs from '@cubejs-client/core';
import { Button, Select, DatePicker, Card, Table, Tabs } from 'antd';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const CustomQueryBuilder = () => {
  const [cubeApi, setCubeApi] = useState(null);
  const [availableCubes, setAvailableCubes] = useState([]);
  const [selectedMeasures, setSelectedMeasures] = useState([]);
  const [selectedDimensions, setSelectedDimensions] = useState([]);
  const [selectedTimeDimension, setSelectedTimeDimension] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [chartType, setChartType] = useState('line');

  const apiUrl = import.meta.env.VITE_CUBEJS_API_URL;
  const token = import.meta.env.VITE_CUBEJS_TOKEN;

  // Initialize Cube API
  useEffect(() => {
    if (apiUrl && token) {
      const api = cubejs(token, { apiUrl });
      setCubeApi(api);
      loadMetadata(api);
    }
  }, [apiUrl, token]);

  // Load available cubes and their members
  const loadMetadata = async (api) => {
    try {
      const meta = await api.meta();
      setAvailableCubes(meta.cubes);
    } catch (error) {
      console.error('Error loading metadata:', error);
    }
  };

  // Build query object
  const query = {
    measures: selectedMeasures,
    dimensions: selectedDimensions,
    ...(selectedTimeDimension && {
      timeDimensions: [{
        dimension: selectedTimeDimension,
        granularity: 'day',
        ...(dateRange && {
          dateRange: [
            dateRange[0].format('YYYY-MM-DD'),
            dateRange[1].format('YYYY-MM-DD')
          ]
        })
      }]
    })
  };

  // Fetch data using the query
  const { resultSet, isLoading, error } = useCubeQuery(
    selectedMeasures.length > 0 ? query : null
  );

  // Get all available measures from all cubes
  const allMeasures = availableCubes.flatMap(cube =>
    cube.measures.map(m => ({
      label: `${m.title || m.name}`,
      value: `${cube.name}.${m.name}`
    }))
  );

  // Get all available dimensions
  const allDimensions = availableCubes.flatMap(cube =>
    cube.dimensions.map(d => ({
      label: `${d.title || d.name}`,
      value: `${cube.name}.${d.name}`,
      type: d.type
    }))
  );

  // Get time dimensions
  const timeDimensions = allDimensions.filter(d => d.type === 'time');

  // Prepare chart data
  const chartData = resultSet ? resultSet.tablePivot() : [];

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Render chart based on type
  const renderChart = () => {
    if (!resultSet || chartData.length === 0) return null;

    const dataKey = selectedMeasures[0] || Object.keys(chartData[0])[1];
    const categoryKey = selectedDimensions[0] || selectedTimeDimension || Object.keys(chartData[0])[0];

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={categoryKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={dataKey} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={categoryKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={dataKey} stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={dataKey}
                nameKey={categoryKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // Render data table
  const renderTable = () => {
    if (!resultSet) return null;

    const columns = Object.keys(chartData[0] || {}).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
    }));

    return (
      <Table
        dataSource={chartData}
        columns={columns}
        pagination={{ pageSize: 10 }}
        scroll={{ x: true }}
      />
    );
  };

  if (!cubeApi) {
    return <div className="p-8">Loading Cube API...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Custom Query Builder</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Query Builder */}
        <div className="w-80 bg-white border-r p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Measures */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Measures
              </label>
              <Select
                mode="multiple"
                placeholder="Select measures"
                style={{ width: '100%' }}
                options={allMeasures}
                value={selectedMeasures}
                onChange={setSelectedMeasures}
              />
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Dimensions
              </label>
              <Select
                mode="multiple"
                placeholder="Select dimensions"
                style={{ width: '100%' }}
                options={allDimensions}
                value={selectedDimensions}
                onChange={setSelectedDimensions}
              />
            </div>

            {/* Time Dimension */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Time Dimension
              </label>
              <Select
                placeholder="Select time dimension"
                style={{ width: '100%' }}
                options={timeDimensions}
                value={selectedTimeDimension}
                onChange={setSelectedTimeDimension}
                allowClear
              />
            </div>

            {/* Date Range */}
            {selectedTimeDimension && (
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Date Range
                </label>
                <RangePicker
                  style={{ width: '100%' }}
                  onChange={setDateRange}
                />
              </div>
            )}

            {/* Chart Type */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                Chart Type
              </label>
              <Select
                value={chartType}
                onChange={setChartType}
                style={{ width: '100%' }}
                options={[
                  { label: 'Line Chart', value: 'line' },
                  { label: 'Bar Chart', value: 'bar' },
                  { label: 'Pie Chart', value: 'pie' },
                ]}
              />
            </div>

            {/* Query Info */}
            {selectedMeasures.length > 0 && (
              <Card size="small" title="Query">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(query, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        </div>

        {/* Main Content - Results */}
        <div className="flex-1 p-6 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-xl">Loading...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700">Error: {error.toString()}</p>
            </div>
          )}

          {!isLoading && !error && selectedMeasures.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-xl mb-2">Select measures to build a query</p>
                <p className="text-sm">Choose from the options in the left sidebar</p>
              </div>
            </div>
          )}

          {!isLoading && !error && resultSet && (
            <Card>
              <Tabs defaultActiveKey="chart">
                <TabPane tab="Chart" key="chart">
                  <div className="p-4">
                    {renderChart()}
                  </div>
                </TabPane>
                <TabPane tab="Table" key="table">
                  <div className="p-4">
                    {renderTable()}
                  </div>
                </TabPane>
                <TabPane tab="JSON" key="json">
                  <pre className="p-4 bg-gray-50 rounded overflow-auto">
                    {JSON.stringify(chartData, null, 2)}
                  </pre>
                </TabPane>
              </Tabs>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomQueryBuilder;