import { useState, useEffect } from 'react';
import { CubeProvider } from '@cubejs-client/react';
import cubejs from '@cubejs-client/core';
import { QueryBuilder } from '@cubejs-client/playground';
import { 
  Button, Modal, Input, Card, Table, Tabs, Space, 
  message, Drawer, List, Collapse, Tag, Empty , Select
} from 'antd';
import { 
  Plus, Save, Download, Trash2, FileJson, Menu, 
  BarChart3, LineChart, PieChart as PieIcon, Table2,
  Minimize2, Maximize2
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart as RechartsLine, Line, 
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import 'antd/dist/reset.css';
import './PlaygroundMultiQueryBuilder.css';

const { Panel } = Collapse;

// Individual Query Builder with Playground UI
const PlaygroundQueryPanel = ({ 
  queryIndex, 
  vizState, 
  onVizStateChange, 
  onRemove, 
  apiUrl, 
  token,
  isExpanded,
  onToggleExpand
}) => {
  const [queryBuilderKey, setQueryBuilderKey] = useState(Date.now());

  return (
    <Card 
      size="small"
      className="query-panel"
      title={
        <div className="flex justify-between items-center w-full">
          <span className="font-semibold">
            {vizState.queryName || `Query ${queryIndex + 1}`}
          </span>
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              onClick={onToggleExpand}
            />
            <Button 
              type="text" 
              danger 
              size="small"
              icon={<Trash2 size={16} />}
              onClick={onRemove}
            >
              Remove
            </Button>
          </Space>
        </div>
      }
    >
      {isExpanded ? (
        <>
          <div className="mb-3">
            <Input
              placeholder="Query name (optional)"
              value={vizState.queryName || ''}
              onChange={(e) => onVizStateChange(queryIndex, { 
                ...vizState, 
                queryName: e.target.value 
              })}
              size="small"
            />
          </div>
          <div className="playground-wrapper">
            <QueryBuilder
              key={queryBuilderKey}
              apiUrl={apiUrl}
              token={token}
              initialVizState={{
                query: vizState.query || {},
                chartType: vizState.chartType || 'line'
              }}
              onVizStateChanged={(newVizState) => {
                onVizStateChange(queryIndex, {
                  ...vizState,
                  query: newVizState.query,
                  chartType: newVizState.chartType
                });
              }}
            />
          </div>
        </>
      ) : (
        <div className="collapsed-query-info">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <strong>Measures:</strong>{' '}
              {vizState.query?.measures?.join(', ') || 'None'}
            </div>
            <div>
              <strong>Dimensions:</strong>{' '}
              {vizState.query?.dimensions?.join(', ') || 'None'}
            </div>
            {vizState.query?.timeDimensions?.length > 0 && (
              <div>
                <strong>Time:</strong>{' '}
                {vizState.query.timeDimensions.map(td => td.dimension).join(', ')}
              </div>
            )}
          </Space>
        </div>
      )}
    </Card>
  );
};

// Combined Results Display
const CombinedResultsDisplay = ({ queries, visualizations, cubeApi }) => {
  const [combinedData, setCombinedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAndCombineData();
  }, [queries]);

  const fetchAndCombineData = async () => {
    if (!cubeApi || queries.length === 0) return;

    const validQueries = queries.filter(
      q => q.query && q.query.measures && q.query.measures.length > 0
    );

    if (validQueries.length === 0) {
      setCombinedData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all queries
      const results = await Promise.all(
        validQueries.map(q => cubeApi.load(q.query))
      );

      // Get data from all queries
      const allData = results.map((result, idx) => ({
        name: validQueries[idx].queryName || `Query ${idx + 1}`,
        data: result.tablePivot(),
        query: validQueries[idx].query
      }));

      // Find common dimensions
      const commonDimensions = findCommonDimensions(allData);

      if (allData.length > 1 && commonDimensions.length > 0) {
        // Combine data based on common dimensions
        const combined = combineDataByDimensions(allData, commonDimensions);
        setCombinedData([{ 
          name: 'Combined Data', 
          data: combined,
          isCombi: true 
        }]);
      } else {
        // Keep separate
        setCombinedData(allData);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.toString());
      setIsLoading(false);
    }
  };

  const findCommonDimensions = (allData) => {
    if (allData.length === 0) return [];
    
    const firstKeys = Object.keys(allData[0].data[0] || {});
    return firstKeys.filter(key => 
      allData.every(dataset => 
        dataset.data.length > 0 && Object.keys(dataset.data[0]).includes(key)
      )
    );
  };

  const combineDataByDimensions = (allData, commonDimensions) => {
    if (allData.length === 1) return allData[0].data;

    // Use first dataset as base
    const baseData = allData[0].data;
    
    // Merge other datasets
    return baseData.map(baseRow => {
      const mergedRow = { ...baseRow };
      
      // For each other dataset
      allData.slice(1).forEach((dataset) => {
        // Find matching row based on common dimensions
        const matchingRow = dataset.data.find(row => 
          commonDimensions.every(dim => row[dim] === baseRow[dim])
        );

        if (matchingRow) {
          // Merge non-dimension fields with prefix
          Object.keys(matchingRow).forEach(key => {
            if (!commonDimensions.includes(key)) {
              const newKey = `${dataset.name}_${key}`;
              mergedRow[newKey] = matchingRow[key];
            }
          });
        }
      });

      return mergedRow;
    });
  };

  const renderVisualization = (vizType) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-lg">Loading data...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded p-4 m-4">
          <p className="text-red-700">Error: {error}</p>
        </div>
      );
    }

    if (combinedData.length === 0) {
      return (
        <Empty 
          description="No data available. Add measures to your queries."
          className="p-12"
        />
      );
    }

    // Render each dataset
    return (
      <div className="space-y-6">
        {combinedData.map((dataset, idx) => {
          const data = dataset.data;
          if (!data || data.length === 0) return null;

          const keys = Object.keys(data[0] || {});
          const dimensionKey = keys[0];
          const measureKeys = keys.slice(1);

          const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

          return (
            <div key={idx}>
              <h3 className="text-lg font-semibold mb-3">{dataset.name}</h3>
              
              {vizType === 'table' && (
                <Table 
                  dataSource={data} 
                  columns={keys.map(key => ({
                    title: key,
                    dataIndex: key,
                    key: key,
                    sorter: (a, b) => {
                      if (typeof a[key] === 'number' && typeof b[key] === 'number') {
                        return a[key] - b[key];
                      }
                      return String(a[key]).localeCompare(String(b[key]));
                    }
                  }))}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                  rowKey={(record, index) => index}
                  size="small"
                />
              )}

              {vizType === 'bar' && (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={dimensionKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {measureKeys.map((key, idx) => (
                      <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}

              {vizType === 'line' && (
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsLine data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={dimensionKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {measureKeys.map((key, idx) => (
                      <Line 
                        key={key} 
                        type="monotone" 
                        dataKey={key} 
                        stroke={COLORS[idx % COLORS.length]} 
                      />
                    ))}
                  </RechartsLine>
                </ResponsiveContainer>
              )}

              {vizType === 'pie' && (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey={measureKeys[0]}
                      nameKey={dimensionKey}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Tabs defaultActiveKey="table">
      {visualizations.map(viz => (
        <Tabs.TabPane 
          tab={
            <span className="flex items-center gap-2">
              {viz === 'table' && <Table2 size={16} />}
              {viz === 'bar' && <BarChart3 size={16} />}
              {viz === 'line' && <LineChart size={16} />}
              {viz === 'pie' && <PieIcon size={16} />}
              {viz.charAt(0).toUpperCase() + viz.slice(1)}
            </span>
          }
          key={viz}
        >
          {renderVisualization(viz)}
        </Tabs.TabPane>
      ))}
    </Tabs>
  );
};

// Main Component
const PlaygroundMultiQueryBuilderContent = ({ cubeApi, apiUrl, token }) => {
  const [queries, setQueries] = useState([
    { query: {}, chartType: 'line', queryName: '' }
  ]);
  const [expandedQueries, setExpandedQueries] = useState([0]);
  const [visualizations, setVisualizations] = useState(['table', 'bar']);
  const [reportName, setReportName] = useState('');
  const [savedReports, setSavedReports] = useState([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('builder');

  useEffect(() => {
    loadSavedReports();

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadSavedReports = () => {
    const saved = localStorage.getItem('playgroundMultiQueryReports');
    if (saved) {
      setSavedReports(JSON.parse(saved));
    }
  };

  const addQuery = () => {
    const newQueryIndex = queries.length;
    setQueries([...queries, { query: {}, chartType: 'line', queryName: '' }]);
    setExpandedQueries([...expandedQueries, newQueryIndex]);
  };

  const removeQuery = (index) => {
    if (queries.length === 1) {
      message.warning('You must have at least one query');
      return;
    }
    const newQueries = queries.filter((_, i) => i !== index);
    setQueries(newQueries);
    setExpandedQueries(expandedQueries.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateVizState = (index, vizState) => {
    const newQueries = [...queries];
    newQueries[index] = vizState;
    setQueries(newQueries);
  };

  const toggleExpand = (index) => {
    if (expandedQueries.includes(index)) {
      setExpandedQueries(expandedQueries.filter(i => i !== index));
    } else {
      setExpandedQueries([...expandedQueries, index]);
    }
  };

  const handleSaveReport = () => {
    if (!reportName.trim()) {
      message.warning('Please enter a report name');
      return;
    }

    const validQueries = queries.filter(
      q => q.query && q.query.measures && q.query.measures.length > 0
    );

    if (validQueries.length === 0) {
      message.warning('Please add at least one measure to your queries');
      return;
    }

    const newReport = {
      id: Date.now(),
      name: reportName,
      queries: queries,
      visualizations: visualizations,
      createdAt: new Date().toISOString(),
    };

    const updatedReports = [...savedReports, newReport];
    setSavedReports(updatedReports);
    localStorage.setItem('playgroundMultiQueryReports', JSON.stringify(updatedReports));

    message.success('Report saved successfully!');
    setSaveModalVisible(false);
    setReportName('');
  };

  const handleLoadReport = (report) => {
    setQueries(report.queries);
    setVisualizations(report.visualizations);
    setExpandedQueries([0]); // Expand first query
    message.success(`Loaded: ${report.name}`);
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  const handleDeleteReport = (reportId) => {
    const updatedReports = savedReports.filter(r => r.id !== reportId);
    setSavedReports(updatedReports);
    localStorage.setItem('playgroundMultiQueryReports', JSON.stringify(updatedReports));
    message.success('Report deleted');
  };

  const handleExportReport = () => {
    const exportData = {
      name: reportName || 'Unnamed Report',
      queries: queries,
      visualizations: visualizations,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Report exported!');
  };

  const hasValidQueries = queries.some(
    q => q.query && q.query.measures && q.query.measures.length > 0
  );

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Saved Reports ({savedReports.length})</h3>
      {savedReports.length === 0 ? (
        <p className="text-gray-500 text-sm">No saved reports yet</p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <List
            dataSource={savedReports}
            renderItem={report => (
              <List.Item className="!px-0">
                <div className="w-full">
                  <div className="mb-2">
                    <p className="font-medium mb-1">{report.name}</p>
                    <p className="text-xs text-gray-500 mb-1">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                    <Space size={4} wrap>
                      <Tag color="blue">{report.queries.length} queries</Tag>
                      <Tag color="green">{report.visualizations.length} viz</Tag>
                    </Space>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="link"
                      size="small"
                      icon={<Download size={14} />}
                      onClick={() => handleLoadReport(report)}
                      className="!px-2"
                    >
                      Load
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDeleteReport(report.id)}
                      className="!px-2"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="playground-multi-builder">
      {/* Header */}
      <div className="builder-header">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button
              type="text"
              icon={<Menu size={20} />}
              onClick={() => setSidebarVisible(true)}
            />
          )}
          <h1 className="text-xl md:text-2xl font-bold">Multi-Query Report Builder</h1>
        </div>
        <Space size="small" wrap>
          <Button
            type="primary"
            icon={<Save size={16} />}
            onClick={() => setSaveModalVisible(true)}
            disabled={!hasValidQueries}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Save'}
          </Button>
          <Button
            icon={<FileJson size={16} />}
            onClick={handleExportReport}
            disabled={!hasValidQueries}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Export'}
          </Button>
        </Space>
      </div>

      <div className="builder-content">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="builder-sidebar">
            <SidebarContent />
          </div>
        )}

        {/* Mobile Drawer */}
        <Drawer
          title="Saved Reports"
          placement="left"
          onClose={() => setSidebarVisible(false)}
          open={sidebarVisible}
          width={280}
        >
          <SidebarContent />
        </Drawer>

        {/* Main Content */}
        <div className="builder-main">
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            className="main-tabs"
          >
            {/* Query Builder Tab */}
            <Tabs.TabPane tab="Build Queries" key="builder">
              <div className="p-4 md:p-6">
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Queries ({queries.length})</h2>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={addQuery}
                  >
                    Add Query
                  </Button>
                </div>

                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {queries.map((query, index) => (
                    <PlaygroundQueryPanel
                      key={index}
                      queryIndex={index}
                      vizState={query}
                      onVizStateChange={updateVizState}
                      onRemove={() => removeQuery(index)}
                      apiUrl={apiUrl}
                      token={token}
                      isExpanded={expandedQueries.includes(index)}
                      onToggleExpand={() => toggleExpand(index)}
                    />
                  ))}
                </Space>
              </div>
            </Tabs.TabPane>

            {/* Visualization Settings Tab */}
            <Tabs.TabPane tab="Visualizations" key="viz">
              <div className="p-4 md:p-6">
                <Card title="Select Visualization Types">
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Choose how to display your combined data:
                      </label>
                      <Select
                        mode="multiple"
                        placeholder="Select visualization types"
                        style={{ width: '100%' }}
                        value={visualizations}
                        onChange={setVisualizations}
                        options={[
                          { 
                            label: (
                              <span className="flex items-center gap-2">
                                <Table2 size={16} /> Table
                              </span>
                            ), 
                            value: 'table' 
                          },
                          { 
                            label: (
                              <span className="flex items-center gap-2">
                                <BarChart3 size={16} /> Bar Chart
                              </span>
                            ), 
                            value: 'bar' 
                          },
                          { 
                            label: (
                              <span className="flex items-center gap-2">
                                <LineChart size={16} /> Line Chart
                              </span>
                            ), 
                            value: 'line' 
                          },
                          { 
                            label: (
                              <span className="flex items-center gap-2">
                                <PieIcon size={16} /> Pie Chart
                              </span>
                            ), 
                            value: 'pie' 
                          },
                        ]}
                      />
                    </div>

                    {visualizations.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Selected:</strong> {visualizations.join(', ')}
                        </p>
                      </div>
                    )}
                  </Space>
                </Card>
              </div>
            </Tabs.TabPane>

            {/* Results Preview Tab */}
            <Tabs.TabPane 
              tab={
                <span>
                  Results Preview {hasValidQueries && <Tag color="green" className="ml-2">Ready</Tag>}
                </span>
              } 
              key="results"
            >
              <div className="p-4 md:p-6">
                {hasValidQueries ? (
                  <CombinedResultsDisplay
                    queries={queries}
                    visualizations={visualizations.length > 0 ? visualizations : ['table']}
                    cubeApi={cubeApi}
                  />
                ) : (
                  <Empty 
                    description="Add measures to your queries to see results"
                    className="p-12"
                  />
                )}
              </div>
            </Tabs.TabPane>
          </Tabs>
        </div>
      </div>

      {/* Save Modal */}
      <Modal
        title="Save Report"
        open={saveModalVisible}
        onOk={handleSaveReport}
        onCancel={() => {
          setSaveModalVisible(false);
          setReportName('');
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="Enter report name"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            onPressEnter={handleSaveReport}
          />
          <div className="text-sm text-gray-500">
            {queries.filter(q => q.query?.measures?.length > 0).length} queries with data will be saved
          </div>
        </Space>
      </Modal>
    </div>
  );
};

// Wrapper
const PlaygroundMultiQueryBuilder = () => {
  const apiUrl = import.meta.env.VITE_CUBEJS_API_URL;
  const token = import.meta.env.VITE_CUBEJS_TOKEN;

  if (!apiUrl || !token) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-sm">Please set VITE_CUBEJS_API_URL and VITE_CUBEJS_TOKEN in your .env file</p>
        </div>
      </div>
    );
  }

  const cubeApi = cubejs(token, { apiUrl });

  return (
    <CubeProvider cubeApi={cubeApi}>
      <PlaygroundMultiQueryBuilderContent 
        cubeApi={cubeApi} 
        apiUrl={apiUrl}
        token={token}
      />
    </CubeProvider>
  );
};

export default PlaygroundMultiQueryBuilder;