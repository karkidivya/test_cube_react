import { useState, useEffect } from 'react';
import { QueryBuilder } from '@cubejs-client/playground';
import { Button, Modal, Input, List, Space, message, Drawer, Select, DatePicker, Card, Divider } from 'antd';
import { Save, Download, Trash2, FileJson, Menu, Filter, X } from 'lucide-react';
import dayjs from 'dayjs';
import 'antd/dist/reset.css';
import './AdminReportBuilder.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AdminReportBuilder = () => {
  const [currentVizState, setCurrentVizState] = useState({
    query: {},
    chartType: 'line'
  });
  const [savedReports, setSavedReports] = useState([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [reportName, setReportName] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [queryBuilderKey, setQueryBuilderKey] = useState(Date.now());
  const [currentReport, setCurrentReport] = useState(null);
  const [dynamicFilters, setDynamicFilters] = useState([]);
  const [availableDimensions, setAvailableDimensions] = useState([]);

  const apiUrl = import.meta.env.VITE_CUBEJS_API_URL;
  const token = import.meta.env.VITE_CUBEJS_TOKEN;

  useEffect(() => {
    loadSavedReports();
    loadAvailableDimensions();
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadAvailableDimensions = async () => {
    if (!apiUrl || !token) return;
    
    try {
      const cubejs = await import('@cubejs-client/core');
      const cubeApi = cubejs.default(token, { apiUrl });
      const meta = await cubeApi.meta();
      
      const dims = meta.cubes.flatMap(cube =>
        cube.dimensions.map(d => ({
          value: `${cube.name}.${d.name}`,
          label: d.title || d.name,
          cubeName: cube.name,
          type: d.type
        }))
      );
      
      setAvailableDimensions(dims);
    } catch (error) {
      console.error('Error loading dimensions:', error);
    }
  };

  const loadSavedReports = () => {
    const saved = localStorage.getItem('adminReports');
    if (saved) {
      setSavedReports(JSON.parse(saved));
    }
  };

  const handleSaveReport = () => {
    if (!reportName.trim()) {
      message.warning('Please enter a report name');
      return;
    }

    const newReport = {
      id: Date.now(),
      name: reportName,
      vizState: currentVizState,
      createdAt: new Date().toISOString(),
      baseQuery: {
        measures: currentVizState.query.measures,
        dimensions: currentVizState.query.dimensions,
        timeDimensions: currentVizState.query.timeDimensions?.map(td => ({
          dimension: td.dimension,
          granularity: td.granularity
        }))
      }
    };

    const updatedReports = [...savedReports, newReport];
    setSavedReports(updatedReports);
    localStorage.setItem('adminReports', JSON.stringify(updatedReports));
    
    message.success('Report saved successfully!');
    setSaveModalVisible(false);
    setReportName('');
  };

  const handleLoadReport = (report) => {
    setCurrentReport(report);
    setDynamicFilters([]);
    setCurrentVizState(report.vizState);
    setQueryBuilderKey(Date.now());
    message.success(`Loaded: ${report.name}`);
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  const handleDeleteReport = (reportId) => {
    const updatedReports = savedReports.filter(r => r.id !== reportId);
    setSavedReports(updatedReports);
    localStorage.setItem('adminReports', JSON.stringify(updatedReports));
    message.success('Report deleted');
    if (currentReport?.id === reportId) {
      setCurrentReport(null);
      setDynamicFilters([]);
    }
  };

  const handleExportQuery = () => {
    const queryJson = JSON.stringify(currentVizState.query, null, 2);
    const blob = new Blob([queryJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Query exported!');
  };

  // Add a new dynamic filter
  const handleAddFilter = () => {
    const newFilter = {
      id: Date.now(),
      dimension: null,
      operator: 'equals',
      values: []
    };
    setDynamicFilters([...dynamicFilters, newFilter]);
  };

  // Update filter property
  const handleUpdateFilter = (filterId, property, value) => {
    setDynamicFilters(prev =>
      prev.map(f => f.id === filterId ? { ...f, [property]: value } : f)
    );
  };

  // Remove a filter
  const handleRemoveFilter = (filterId) => {
    setDynamicFilters(prev => prev.filter(f => f.id !== filterId));
  };

  // Apply filters to the query
  const handleApplyFilters = () => {
    if (!currentReport) {
      message.warning('Please load a report first');
      return;
    }

    // Build filters array for Cube query
    const cubeFilters = dynamicFilters
      .filter(f => f.dimension && f.values.length > 0)
      .map(f => ({
        member: f.dimension,
        operator: f.operator,
        values: f.values
      }));

    // Create new viz state with filters applied
    const newVizState = {
      ...currentReport.vizState,
      query: {
        ...currentReport.baseQuery,
        filters: cubeFilters
      }
    };

    setCurrentVizState(newVizState);
    setQueryBuilderKey(Date.now());
    message.success(`Applied ${cubeFilters.length} filter(s)`);
    setFilterPanelVisible(false);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setDynamicFilters([]);
    if (currentReport) {
      setCurrentVizState(currentReport.vizState);
      setQueryBuilderKey(Date.now());
      message.success('Filters cleared');
    }
  };

  // Get dimension type
  const getDimensionType = (dimensionName) => {
    const dim = availableDimensions.find(d => d.value === dimensionName);
    return dim?.type || 'string';
  };

  if (!apiUrl || !token) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-sm">Please set VITE_CUBEJS_API_URL and VITE_CUBEJS_TOKEN in your .env file</p>
        </div>
      </div>
    );
  };

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
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium mb-1">
                        {report.name}
                        {currentReport?.id === report.id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
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

  const FilterPanel = () => {
    // Get available dimensions from current report
    const reportDimensions = currentReport?.baseQuery?.dimensions || [];
    const reportTimeDimensions = currentReport?.baseQuery?.timeDimensions?.map(td => td.dimension) || [];
    const allReportDimensions = [...reportDimensions, ...reportTimeDimensions];

    const availableFilterDimensions = availableDimensions.filter(d =>
      allReportDimensions.includes(d.value)
    );

    return (
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Dynamic Filters</h3>
          {currentReport ? (
            <div className="p-3 bg-blue-50 rounded text-sm">
              <strong>Report:</strong> {currentReport.name}
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 rounded text-sm text-yellow-700">
              Please load a report first
            </div>
          )}
        </div>

        {dynamicFilters.map((filter, index) => {
          const dimensionType = filter.dimension ? getDimensionType(filter.dimension) : 'string';

          return (
            <Card key={filter.id} size="small" className="mb-3">
              <div className="space-y-3">
                {/* Dimension Selection */}
                <div>
                  <label className="block text-xs font-semibold mb-1">Dimension</label>
                  <Select
                    placeholder="Select dimension"
                    style={{ width: '100%' }}
                    value={filter.dimension}
                    onChange={(value) => handleUpdateFilter(filter.id, 'dimension', value)}
                    disabled={!currentReport}
                  >
                    {availableFilterDimensions.map(dim => (
                      <Option key={dim.value} value={dim.value}>
                        {dim.label} ({dim.type})
                      </Option>
                    ))}
                  </Select>
                </div>

                {/* Operator Selection */}
                <div>
                  <label className="block text-xs font-semibold mb-1">Operator</label>
                  <Select
                    style={{ width: '100%' }}
                    value={filter.operator}
                    onChange={(value) => handleUpdateFilter(filter.id, 'operator', value)}
                  >
                    <Option value="equals">Equals</Option>
                    <Option value="notEquals">Not Equals</Option>
                    <Option value="contains">Contains</Option>
                    <Option value="notContains">Not Contains</Option>
                    {dimensionType === 'time' && (
                      <>
                        <Option value="inDateRange">In Date Range</Option>
                        <Option value="beforeDate">Before Date</Option>
                        <Option value="afterDate">After Date</Option>
                      </>
                    )}
                    {dimensionType === 'number' && (
                      <>
                        <Option value="gt">Greater Than</Option>
                        <Option value="gte">Greater Than or Equal</Option>
                        <Option value="lt">Less Than</Option>
                        <Option value="lte">Less Than or Equal</Option>
                      </>
                    )}
                  </Select>
                </div>

                {/* Value Input */}
                <div>
                  <label className="block text-xs font-semibold mb-1">Value</label>
                  {dimensionType === 'time' && filter.operator === 'inDateRange' ? (
                    <RangePicker
                      style={{ width: '100%' }}
                      onChange={(dates) => {
                        if (dates) {
                          handleUpdateFilter(filter.id, 'values', [
                            dates[0].format('YYYY-MM-DD'),
                            dates[1].format('YYYY-MM-DD')
                          ]);
                        }
                      }}
                    />
                  ) : dimensionType === 'time' ? (
                    <DatePicker
                      style={{ width: '100%' }}
                      onChange={(date) => {
                        if (date) {
                          handleUpdateFilter(filter.id, 'values', [date.format('YYYY-MM-DD')]);
                        }
                      }}
                    />
                  ) : (
                    <Input
                      placeholder="Enter value"
                      value={filter.values[0] || ''}
                      onChange={(e) => handleUpdateFilter(filter.id, 'values', [e.target.value])}
                    />
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  danger
                  size="small"
                  icon={<X size={14} />}
                  onClick={() => handleRemoveFilter(filter.id)}
                  block
                >
                  Remove Filter
                </Button>
              </div>
            </Card>
          );
        })}

        <Button
          type="dashed"
          onClick={handleAddFilter}
          block
          className="mb-3"
          disabled={!currentReport}
        >
          + Add Filter
        </Button>

        <Divider />

        <div className="space-y-2">
          <Button
            type="primary"
            onClick={handleApplyFilters}
            block
            disabled={dynamicFilters.length === 0}
          >
            Apply Filters ({dynamicFilters.filter(f => f.dimension && f.values.length > 0).length})
          </Button>
          <Button
            onClick={handleClearFilters}
            block
            disabled={dynamicFilters.length === 0 && !currentReport}
          >
            Clear All Filters
          </Button>
        </div>

        {/* Current Filters Summary */}
        {dynamicFilters.filter(f => f.dimension && f.values.length > 0).length > 0 && (
          <Card size="small" className="mt-4" title="Active Filters">
            <div className="space-y-2">
              {dynamicFilters
                .filter(f => f.dimension && f.values.length > 0)
                .map(f => (
                  <div key={f.id} className="text-xs bg-gray-50 p-2 rounded">
                    <strong>{f.dimension}</strong> {f.operator} {f.values.join(', ')}
                  </div>
                ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="admin-report-builder">
      {/* Header */}
      <div className="admin-header">
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button
              type="text"
              icon={<Menu size={20} />}
              onClick={() => setSidebarVisible(true)}
            />
          )}
          <h1 className="text-xl md:text-2xl font-bold">Admin Report Builder</h1>
        </div>
        <Space size="small" wrap>
          <Button 
            icon={<Filter size={16} />}
            onClick={() => setFilterPanelVisible(true)}
            size={isMobile ? 'small' : 'middle'}
            disabled={!currentReport}
            type={dynamicFilters.filter(f => f.dimension && f.values.length > 0).length > 0 ? 'primary' : 'default'}
          >
            {!isMobile && 'Filters'}
            {dynamicFilters.filter(f => f.dimension && f.values.length > 0).length > 0 && (
              <span className="ml-1">
                ({dynamicFilters.filter(f => f.dimension && f.values.length > 0).length})
              </span>
            )}
          </Button>
          <Button 
            type="primary" 
            icon={<Save size={16} />}
            onClick={() => setSaveModalVisible(true)}
            disabled={!currentVizState.query.measures?.length}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Save'}
          </Button>
          <Button 
            icon={<FileJson size={16} />}
            onClick={handleExportQuery}
            size={isMobile ? 'small' : 'middle'}
          >
            {!isMobile && 'Export'}
          </Button>
        </Space>
      </div>

      <div className="admin-content">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="admin-sidebar">
            <SidebarContent />
          </div>
        )}

        {/* Mobile Drawer for Reports */}
        <Drawer
          title="Saved Reports"
          placement="left"
          onClose={() => setSidebarVisible(false)}
          open={sidebarVisible}
          width={280}
        >
          <SidebarContent />
        </Drawer>

        {/* Filter Panel Drawer */}
        <Drawer
          title="Filter Panel"
          placement="right"
          onClose={() => setFilterPanelVisible(false)}
          open={filterPanelVisible}
          width={isMobile ? '90%' : 400}
        >
          <FilterPanel />
        </Drawer>

        {/* Main Query Builder */}
        <div className="admin-main">
          <QueryBuilder 
            key={queryBuilderKey}
            apiUrl={apiUrl}
            token={token}
            initialVizState={currentVizState}
            onVizStateChanged={(vizState) => {
              setCurrentVizState(vizState);
            }}
          />
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
        <Input
          placeholder="Enter report name"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          onPressEnter={handleSaveReport}
        />
      </Modal>
    </div>
  );
};

export default AdminReportBuilder;