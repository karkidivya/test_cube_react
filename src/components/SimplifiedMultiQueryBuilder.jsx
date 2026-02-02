import { useState, useEffect } from 'react';
import { CubeProvider } from '@cubejs-client/react';
import cubejs from '@cubejs-client/core';
import { 
  Button, Card, Table, Space, message, 
  Input, DatePicker, Select, Row, Col, Spin, Alert, Divider, Tag, Form
} from 'antd';
import { 
  Plus, Trash2, Play, Download, FileJson, 
  Calendar, Database, RefreshCw, Filter, CheckCircle, Link
} from 'lucide-react';
import dayjs from 'dayjs';
import 'antd/dist/reset.css';
import './SmartQueryExecutor.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

// Query Input Component
const QueryInput = ({ queries, setQueries }) => {
  const addQuery = () => {
    setQueries([
      ...queries,
      { 
        id: Date.now(),
        name: `Query ${queries.length + 1}`,
        cubeQuery: '{\n  "measures": [],\n  "dimensions": [],\n  "timeDimensions": []\n}'
      }
    ]);
  };

  const updateQuery = (id, field, value) => {
    setQueries(queries.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuery = (id) => {
    if (queries.length === 1) {
      message.warning('You must have at least one query');
      return;
    }
    setQueries(queries.filter(q => q.id !== id));
  };

  const validateQuery = (queryStr) => {
    try {
      JSON.parse(queryStr);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Card className="query-input-section" title="1. Define Your Queries">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {queries.map((query, index) => (
          <Card 
            key={query.id}
            type="inner"
            className="query-card"
            title={
              <div className="query-card-header">
                <Input
                  value={query.name}
                  onChange={(e) => updateQuery(query.id, 'name', e.target.value)}
                  placeholder="Query name"
                  style={{ width: 200 }}
                />
                {queries.length > 1 && (
                  <Button
                    danger
                    size="small"
                    icon={<Trash2 size={14} />}
                    onClick={() => removeQuery(query.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            }
          >
            <TextArea
              value={query.cubeQuery}
              onChange={(e) => updateQuery(query.id, 'cubeQuery', e.target.value)}
              placeholder='{"measures": ["Orders.count"], "dimensions": ["Orders.status"]}'
              rows={10}
              className={validateQuery(query.cubeQuery) ? 'valid-query' : 'invalid-query'}
            />
            {!validateQuery(query.cubeQuery) && (
              <Alert
                message="Invalid JSON format"
                type="error"
                showIcon
                className="mt-2"
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        ))}
        
        <Button
          type="dashed"
          onClick={addQuery}
          icon={<Plus size={16} />}
          block
        >
          Add Query
        </Button>
      </Space>
    </Card>
  );
};

// Unified Filter Panel Component
const UnifiedFilterPanel = ({ 
  queries,
  dateRange, 
  setDateRange, 
  businessIds, 
  setBusinessIds,
  onExecute,
  isLoading
}) => {
  const [dimensionMapping, setDimensionMapping] = useState({
    timeDimensions: [],
    businessIdDimensions: []
  });

  // Analyze all queries and group similar dimensions
  useEffect(() => {
    const timeDims = [];
    const businessDims = [];

    queries.forEach((q, idx) => {
      try {
        const parsed = JSON.parse(q.cubeQuery);
        
        // Extract time dimensions
        if (parsed.timeDimensions) {
          parsed.timeDimensions.forEach(td => {
            if (td.dimension) {
              timeDims.push({
                queryIndex: idx,
                queryName: q.name,
                dimension: td.dimension,
                granularity: td.granularity
              });
            }
          });
        }
        
        // Extract business ID dimensions
        if (parsed.dimensions) {
          parsed.dimensions.forEach(dim => {
            if (dim.toLowerCase().includes('business') || 
                dim.toLowerCase().includes('customer') ||
                dim.toLowerCase().includes('id')) {
              businessDims.push({
                queryIndex: idx,
                queryName: q.name,
                dimension: dim
              });
            }
          });
        }
      } catch (err) {
        // Invalid JSON, skip
      }
    });

    setDimensionMapping({
      timeDimensions: timeDims,
      businessIdDimensions: businessDims
    });
  }, [queries]);

  const hasTimeDimensions = dimensionMapping.timeDimensions.length > 0;
  const hasBusinessDimensions = dimensionMapping.businessIdDimensions.length > 0;

  return (
    <Card className="filter-panel" title="2. Set Unified Filters (Applied to All Queries)">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Dimension Mapping Info */}
        {(hasTimeDimensions || hasBusinessDimensions) && (
          <Alert
            message="Auto-detected Filter Dimensions"
            description={
              <div>
                {hasTimeDimensions && (
                  <div className="mb-2">
                    <strong>Date/Time Dimensions Found:</strong>
                    <div className="mt-1">
                      {dimensionMapping.timeDimensions.map((item, idx) => (
                        <div key={idx} className="ml-4">
                          <Tag color="purple">{item.queryName}</Tag>
                          <span className="text-gray-700">{item.dimension}</span>
                          {item.granularity && (
                            <Tag color="blue" className="ml-2">{item.granularity}</Tag>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasBusinessDimensions && (
                  <div>
                    <strong>Business ID Dimensions Found:</strong>
                    <div className="mt-1">
                      {dimensionMapping.businessIdDimensions.map((item, idx) => (
                        <div key={idx} className="ml-4">
                          <Tag color="green">{item.queryName}</Tag>
                          <span className="text-gray-700">{item.dimension}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
            type="info"
            showIcon
            icon={<CheckCircle />}
          />
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div className="filter-field">
              <label className="filter-label">
                <Calendar size={14} />
                Date Range <span className="required">*</span>
              </label>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                disabled={!hasTimeDimensions}
              />
              <p className="hint">
                {hasTimeDimensions 
                  ? `Will be applied to ${dimensionMapping.timeDimensions.length} time dimension(s)`
                  : 'No time dimensions detected in queries'
                }
              </p>
            </div>
          </Col>
          
          <Col xs={24} md={12}>
            <div className="filter-field">
              <label className="filter-label">
                <Database size={14} />
                Business IDs
              </label>
              <Select
                mode="tags"
                value={businessIds}
                onChange={setBusinessIds}
                style={{ width: '100%' }}
                placeholder="Enter business IDs (comma-separated)"
                tokenSeparators={[',']}
                disabled={!hasBusinessDimensions}
              />
              <p className="hint">
                {hasBusinessDimensions 
                  ? `Will be applied to ${dimensionMapping.businessIdDimensions.length} business dimension(s)`
                  : 'No business ID dimensions detected'
                }
              </p>
            </div>
          </Col>
        </Row>

        <Divider />

        {/* Filter Summary */}
        {dateRange && (
          <Alert
            message="Filter Configuration"
            description={
              <div>
                <div className="mb-2">
                  <CheckCircle size={14} className="inline mr-2 text-green-600" />
                  <strong>Date Range:</strong> {dateRange[0].format('YYYY-MM-DD')} to {dateRange[1].format('YYYY-MM-DD')}
                </div>
                <div className="ml-6 text-sm text-gray-600">
                  Will filter: {dimensionMapping.timeDimensions.map(d => d.dimension).join(', ')}
                </div>
                
                {businessIds.length > 0 && (
                  <>
                    <div className="mt-2">
                      <CheckCircle size={14} className="inline mr-2 text-green-600" />
                      <strong>Business IDs:</strong> {businessIds.join(', ')}
                    </div>
                    <div className="ml-6 text-sm text-gray-600">
                      Will filter: {dimensionMapping.businessIdDimensions.map(d => d.dimension).join(', ')}
                    </div>
                  </>
                )}
              </div>
            }
            type="success"
            showIcon
          />
        )}

        <Button
          type="primary"
          size="large"
          icon={<Play size={18} />}
          onClick={onExecute}
          loading={isLoading}
          block
          disabled={!dateRange || !hasTimeDimensions}
        >
          Execute {queries.length} {queries.length === 1 ? 'Query' : 'Queries'} & Merge Results
        </Button>

        {!dateRange && hasTimeDimensions && (
          <Alert
            message="Date Range is required"
            type="warning"
            showIcon
          />
        )}

        {!hasTimeDimensions && (
          <Alert
            message="No time dimensions found in queries"
            description="Add timeDimensions to your queries to enable date filtering"
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

// Manual Dimension Mapping Component
const ManualDimensionMapping = ({ queries, dimensionMappings, setDimensionMappings }) => {
  const [allDimensions, setAllDimensions] = useState([]);

  // Extract all dimensions from all queries
  useEffect(() => {
    const dimensionsByQuery = {};

    queries.forEach((q, idx) => {
      try {
        const parsed = JSON.parse(q.cubeQuery);
        const dims = [];
        
        // Add time dimensions
        if (parsed.timeDimensions) {
          parsed.timeDimensions.forEach(td => {
            if (td.dimension) {
              dims.push({ dimension: td.dimension, type: 'time' });
            }
          });
        }
        
        // Add regular dimensions
        if (parsed.dimensions) {
          parsed.dimensions.forEach(dim => {
            dims.push({ dimension: dim, type: 'regular' });
          });
        }
        
        if (dims.length > 0) {
          dimensionsByQuery[idx] = {
            queryName: q.name,
            dimensions: dims
          };
        }
      } catch (err) {
        // Invalid JSON, skip
      }
    });

    setAllDimensions(dimensionsByQuery);
  }, [queries]);

  const addMapping = () => {
    setDimensionMappings([
      ...dimensionMappings,
      { id: Date.now(), mappings: {} }
    ]);
  };

  const removeMapping = (id) => {
    setDimensionMappings(dimensionMappings.filter(m => m.id !== id));
  };

  const updateMapping = (mappingId, queryIndex, dimension) => {
    setDimensionMappings(dimensionMappings.map(m => {
      if (m.id === mappingId) {
        return {
          ...m,
          mappings: {
            ...m.mappings,
            [queryIndex]: dimension
          }
        };
      }
      return m;
    }));
  };

  const getMappingName = (mapping) => {
    const dims = Object.values(mapping.mappings).filter(Boolean);
    if (dims.length === 0) return 'Unmapped';
    return dims[0].split('.')[1] || dims[0];
  };

  if (queries.length < 2) {
    return (
      <Card className="merge-config" title="3. Dimension Mapping for Merge">
        <Alert
          message="Single Query Detected"
          description="Add more queries to enable dimension mapping and merging."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card className="merge-config" title="3. Map Dimensions for Merging">
      <Alert
        message="Manual Dimension Mapping"
        description="Map dimensions with different names across queries to merge results. Results will be merged using FULL OUTER JOIN - all rows from all queries will be included, with missing values filled with 0."
        type="info"
        showIcon
        icon={<Link />}
        className="mb-4"
      />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {dimensionMappings.map((mapping, idx) => (
          <Card
            key={mapping.id}
            type="inner"
            size="small"
            title={
              <div className="flex justify-between items-center">
                <span>Mapping Group {idx + 1}: {getMappingName(mapping)}</span>
                <Button
                  danger
                  size="small"
                  icon={<Trash2 size={14} />}
                  onClick={() => removeMapping(mapping.id)}
                >
                  Remove
                </Button>
              </div>
            }
          >
            <Row gutter={16}>
              {Object.keys(allDimensions).map((queryIdx) => {
                const queryInfo = allDimensions[queryIdx];
                return (
                  <Col key={queryIdx} xs={24} md={12} lg={8}>
                    <div className="filter-field">
                      <label className="filter-label">
                        <Tag color="blue">{queryInfo.queryName}</Tag>
                      </label>
                      <Select
                        value={mapping.mappings[queryIdx]}
                        onChange={(value) => updateMapping(mapping.id, queryIdx, value)}
                        style={{ width: '100%' }}
                        placeholder="Select dimension"
                        allowClear
                      >
                        {queryInfo.dimensions.map((dim) => (
                          <Select.Option key={dim.dimension} value={dim.dimension}>
                            <Space>
                              {dim.type === 'time' && <Calendar size={12} className="text-purple-500" />}
                              {dim.type === 'regular' && <Database size={12} className="text-blue-500" />}
                              {dim.dimension}
                            </Space>
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        ))}

        <Button
          type="dashed"
          onClick={addMapping}
          icon={<Plus size={16} />}
          block
        >
          Add Dimension Mapping
        </Button>

        {dimensionMappings.length > 0 && (
          <Alert
            message="Merge Configuration"
            description={
              <div>
                <p className="mb-2">Results will be merged on the following mapped dimensions:</p>
                {dimensionMappings.map((mapping, idx) => {
                  const mappedDims = Object.entries(mapping.mappings)
                    .filter(([_, dim]) => dim)
                    .map(([queryIdx, dim]) => `${allDimensions[queryIdx]?.queryName}: ${dim}`);
                  
                  if (mappedDims.length === 0) return null;
                  
                  return (
                    <div key={idx} className="mb-2">
                      <strong>Group {idx + 1}:</strong>
                      <div className="ml-4 text-sm">
                        {mappedDims.map((dim, i) => (
                          <div key={i}>• {dim}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
            type="success"
            showIcon
          />
        )}

        {dimensionMappings.length === 0 && (
          <Alert
            message="No Dimension Mappings"
            description="Add dimension mappings to merge query results. Without mappings, queries will be displayed separately."
            type="warning"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

// Results Display Component
const ResultsDisplay = ({ results, onExport, isLoading, executionSummary }) => {
  // Add debugging and clean the data
  useEffect(() => {
    if (results && results.length > 0) {
      console.log('=== RESULTS DISPLAY DEBUG ===');
      console.log('Number of rows:', results.length);
      console.log('First row keys:', Object.keys(results[0]));
      console.log('First row:', results[0]);
      console.log('All rows:', results);
      console.log('=== END RESULTS DISPLAY DEBUG ===');
    }
  }, [results]);

  // Clean the results data - remove duplicate dimension columns
  const cleanedResults = results && results.length > 0 ? results.map(row => {
    const cleanedRow = { ...row };
    
    // Remove any column that starts with "Query X." and contains dimension keywords
    Object.keys(cleanedRow).forEach(key => {
      // Remove Query 2+ dimension columns
      if (key.startsWith('Query ') && 
          (key.toLowerCase().includes('transactiondate') || 
           key.toLowerCase().includes('businessid') || 
           key.toLowerCase().includes('salesbusinessid') ||
           key.toLowerCase().includes('servicequeue'))) {
        delete cleanedRow[key];
      }
      
      // Remove year/month/week/hour granularity columns
      if (key.includes('.year') || key.includes('.month') || 
          key.includes('.week') || key.includes('.hour')) {
        delete cleanedRow[key];
      }
    });
    
    return cleanedRow;
  }) : results;

  if (isLoading) {
    return (
      <Card className="results-section">
        <div className="loading-state">
          <Spin size="large" />
          <p className="mt-4">Executing queries with filters and merging results...</p>
        </div>
      </Card>
    );
  }

  if (!cleanedResults || cleanedResults.length === 0) {
    return (
      <Card className="results-section" title="4. Results">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Results Yet</h3>
          <p>Set your filters and click "Execute Queries & Merge Results"</p>
        </div>
      </Card>
    );
  }

  const columns = Object.keys(cleanedResults[0] || {})
    .filter(key => {
      // Remove duplicate time dimension columns with different granularities
      // Keep only .day granularity, remove .year, .month, .week, .hour
      if (key.includes('.year') || key.includes('.month') || key.includes('.week') || key.includes('.hour')) {
        return false;
      }
      
      // Remove Query 2+ dimension columns that start with query name prefix
      // These are duplicate dimensions already shown from Query 1
      if (key.startsWith('Query ') && 
          (key.includes('TransactionDate') || 
           key.includes('BusinessID') || 
           key.includes('SalesBusinessID') ||
           key.includes('Date'))) {
        return false;
      }
      
      return true;
    })
    .map(key => {
      // Clean up column names for better display
      let displayTitle = key;
      
      // Remove .day suffix from dimension names for cleaner display
      if (key.includes('.day')) {
        displayTitle = key.replace('.day', '');
      }
      
      // Remove "Query X." prefix for cleaner display
      if (displayTitle.startsWith('Query ')) {
        displayTitle = displayTitle.replace(/^Query \d+\./, '');
      }
      
      // Remove table prefixes for cleaner display (e.g., "business_sales." -> "")
      const parts = displayTitle.split('.');
      if (parts.length > 1) {
        displayTitle = parts[parts.length - 1]; // Get last part only
      }
      
      return {
        title: displayTitle,
        dataIndex: key,
        key: key,
        sorter: (a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal || '').localeCompare(String(bVal || ''));
        },
        ellipsis: true,
        width: 150,
        render: (text, record) => {
          if (text === null || text === undefined) {
            return <span className="null-value">-</span>;
          }
          
          // Format date values
          if (typeof text === 'string' && text.includes('T')) {
            return text.split('T')[0];
          }
          
          // Format numbers
          if (typeof text === 'number') {
            return text.toLocaleString();
          }
          
          return String(text);
        }
      };
    });

  return (
    <Card 
      className="results-section" 
      title={
        <div className="results-header">
          <div>
            <span>4. Merged Results</span>
            <span className="row-count">{cleanedResults.length} rows</span>
          </div>
          <Space>
            <Button
              icon={<Download size={16} />}
              onClick={() => onExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              icon={<FileJson size={16} />}
              onClick={() => onExport('json')}
            >
              Export JSON
            </Button>
          </Space>
        </div>
      }
    >
      {executionSummary && (
        <Alert
          message="Execution Summary"
          description={
            <div className="text-sm">
              <div>✓ Executed {executionSummary.queriesExecuted} queries successfully</div>
              <div>✓ Applied filters to all time and business dimensions</div>
              {executionSummary.mergedOn && (
                <div>✓ Merged results on: {executionSummary.mergedOn}</div>
              )}
              <div>✓ Retrieved {cleanedResults.length} rows</div>
            </div>
          }
          type="success"
          showIcon
          className="mb-4"
        />
      )}

      <Table
        dataSource={cleanedResults}
        columns={columns}
        rowKey={(_, index) => index}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200],
          showTotal: (total) => `Total ${total} rows`
        }}
        scroll={{ x: true }}
        bordered
        size="small"
      />
    </Card>
  );
};

// Main Component
const SmartQueryExecutorContent = ({ cubeApi }) => {
  // Query state
  const [queries, setQueries] = useState([
    { 
      id: Date.now(),
      name: 'Query 1',
      cubeQuery: '{\n  "measures": [],\n  "dimensions": [],\n  "timeDimensions": []\n}'
    }
  ]);

  // Filter state
  const [dateRange, setDateRange] = useState(null);
  const [businessIds, setBusinessIds] = useState([]);

  // Dimension mapping state
  const [dimensionMappings, setDimensionMappings] = useState([]);

  // Results state
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executionSummary, setExecutionSummary] = useState(null);

  // Execute queries with unified filters
  const executeQueries = async () => {
    // Validate inputs
    if (!dateRange) {
      message.error('Please select a date range');
      return;
    }

    // Parse and validate queries
    const parsedQueries = [];
    for (const q of queries) {
      try {
        const parsed = JSON.parse(q.cubeQuery);
        parsedQueries.push({ name: q.name, query: parsed, id: q.id });
      } catch (err) {
        message.error(`Invalid JSON in query "${q.name}"`);
        return;
      }
    }

    setIsLoading(true);
    setResults(null);
    setExecutionSummary(null);

    try {
      // Apply filters to each query independently
      const modifiedQueries = parsedQueries.map(({ name, query, id }) => {
        const modifiedQuery = JSON.parse(JSON.stringify(query)); // Deep clone
        
        // Update date range in ALL timeDimensions
        if (modifiedQuery.timeDimensions) {
          modifiedQuery.timeDimensions = modifiedQuery.timeDimensions.map(td => ({
            ...td,
            dateRange: [
              dateRange[0].format('YYYY-MM-DD'),
              dateRange[1].format('YYYY-MM-DD')
            ]
          }));
        }

        // Apply business ID filter to ALL business-related dimensions
        if (businessIds.length > 0 && modifiedQuery.dimensions) {
          const filters = modifiedQuery.filters || [];
          
          modifiedQuery.dimensions.forEach(dim => {
            if (dim.toLowerCase().includes('business') || 
                dim.toLowerCase().includes('customer') ||
                dim.toLowerCase().includes('id')) {
              filters.push({
                member: dim,
                operator: 'equals',
                values: businessIds
              });
            }
          });
          
          if (filters.length > 0) {
            modifiedQuery.filters = filters;
          }
        }

        return { name, query: modifiedQuery, id };
      });

      console.log('Executing queries with filters:', modifiedQueries);

      // Execute all queries in parallel
      const queryResults = await Promise.all(
        modifiedQueries.map(({ query }) => cubeApi.load(query))
      );

      // Convert to table data with query index
      const tableData = queryResults.map((result, idx) => ({
        name: modifiedQueries[idx].name,
        queryIndex: idx,
        data: result.tablePivot()
      }));

      console.log('Query results:', tableData);

      // Merge results using manual mappings
      let finalResults;
      let mergedOn = null;

      if (dimensionMappings.length > 0 && tableData.length > 1) {
        finalResults = mergeResultsWithMapping(tableData, dimensionMappings);
        mergedOn = dimensionMappings.length + ' dimension mapping(s)';
      } else if (tableData.length === 1) {
        finalResults = tableData[0].data;
      } else {
        // No mappings - concatenate all results
        finalResults = tableData.flatMap(({ name, data }) => 
          data.map(row => ({ ...row, _source_query: name }))
        );
      }

      setResults(finalResults);
      setExecutionSummary({
        queriesExecuted: queries.length,
        mergedOn: mergedOn
      });

      message.success(
        `Successfully executed ${queries.length} queries and retrieved ${finalResults.length} rows`
      );
    } catch (err) {
      console.error('Error executing queries:', err);
      message.error(`Error: ${err.message || 'Failed to execute queries'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Merge results using manual dimension mappings with FULL OUTER JOIN
  // Uses the same approach as backend: Map with composite keys (date|business_id)
  // Aggregates duplicate keys by summing measure values
  const mergeResultsWithMapping = (tableData, mappings) => {
    if (tableData.length === 0) return [];
    if (tableData.length === 1) return tableData[0].data;

    console.log('=== MERGE DEBUG START ===');
    console.log('Mappings:', JSON.stringify(mappings, null, 2));
    console.log('Table data structure:', tableData.map(t => ({
      name: t.name,
      queryIndex: t.queryIndex,
      rowCount: t.data.length,
      firstRow: t.data[0]
    })));

    // Helper function to extract dimension values for creating composite key
    const getCompositeKey = (row, queryIndex) => {
      console.log(`\nBuilding key for queryIndex ${queryIndex}:`, row);
      
      const keyParts = mappings.map(mapping => {
        const dim = mapping.mappings[queryIndex];
        console.log(`  Mapping: queryIndex=${queryIndex}, dimension=${dim}`);
        
        if (!dim) {
          console.log('    -> No dimension found, returning null');
          return null;
        }
        
        // Try to get value - first exact match, then with .day/.month/.year suffix
        let val = row[dim];
        
        if (val === undefined) {
          // Try with common Cube.js time granularity suffixes
          const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
          for (const suffix of suffixes) {
            const dimWithSuffix = dim + suffix;
            if (row[dimWithSuffix] !== undefined) {
              val = row[dimWithSuffix];
              console.log(`    -> Found value with suffix ${suffix}: ${dimWithSuffix}`);
              break;
            }
          }
        }
        
        console.log(`    -> Raw value from row:`, val);
        
        // Extract date part if it's a datetime string (2026-01-05T00:00:00.000)
        if (val && typeof val === 'string' && val.includes('T')) {
          val = val.split('T')[0]; // Get just the date part: "2026-01-05"
          console.log(`    -> Extracted date part:`, val);
        }
        
        return val != null ? String(val) : null;
      }).filter(k => k !== null);
      
      const compositeKey = keyParts.join('|');
      console.log(`  Final composite key: "${compositeKey}"`);
      return compositeKey;
    };

    // Identify measure columns (non-dimension columns) for each query
    const measureColumnsByQuery = tableData.map(({ data, queryIndex, name }) => {
      if (data.length === 0) return { queryIndex, name, measures: [] };
      
      // Get mapped dimensions for this query
      const mappedDims = new Set(
        mappings.map(m => m.mappings[queryIndex]).filter(Boolean)
      );
      
      console.log(`Mapped dimensions for query ${queryIndex} (${name}):`, Array.from(mappedDims));
      
      // All non-dimension columns are measures
      const measures = Object.keys(data[0]).filter(key => !mappedDims.has(key));
      console.log(`Measure columns for query ${queryIndex} (${name}):`, measures);
      
      return { queryIndex, name, measures };
    });

    // Create a Map to store merged data by composite key (same as backend approach)
    const dataByKey = new Map();

    // Process each query's data
    tableData.forEach(({ data, queryIndex, name }, idx) => {
      console.log(`\n=== Processing Query ${idx} (${name}) - ${data.length} rows ===`);
      
      const mappedDims = new Set(
        mappings.map(m => m.mappings[queryIndex]).filter(Boolean)
      );

      data.forEach((row, rowIdx) => {
        const key = getCompositeKey(row, queryIndex);
        if (!key) {
          console.log(`  Row ${rowIdx}: Skipped (no valid key)`);
          return;
        }

        console.log(`  Row ${rowIdx}: Key = "${key}"`);

        // Get or create entry for this key
        if (!dataByKey.has(key)) {
          console.log(`    -> Creating new entry for key "${key}"`);
          
          // Initialize new entry with dimension values from first occurrence
          const newEntry = {};
          
          // Use first query's dimension names as canonical keys
          // But get values from whichever query has them (current query)
          mappings.forEach(mapping => {
            const firstQueryDim = mapping.mappings[0]; // Use Query 1's dimension name as the column key
            const currentQueryDim = mapping.mappings[queryIndex]; // Get value from current query
            
            if (firstQueryDim && currentQueryDim) {
              // Try to get value - first exact match, then with .day/.month/.year suffix
              let val = row[currentQueryDim];
              
              if (val === undefined) {
                // Try with common Cube.js time granularity suffixes
                const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
                for (const suffix of suffixes) {
                  const dimWithSuffix = currentQueryDim + suffix;
                  if (row[dimWithSuffix] !== undefined) {
                    val = row[dimWithSuffix];
                    console.log(`      Found dimension value with suffix: ${dimWithSuffix} = ${val}`);
                    break;
                  }
                }
              }
              
              if (val !== undefined) {
                // Extract date part for dimension values too
                if (val && typeof val === 'string' && val.includes('T')) {
                  val = val.split('T')[0];
                }
                newEntry[firstQueryDim] = val;
                console.log(`      Dimension: ${firstQueryDim} = ${val}`);
              }
            }
          });
          
          dataByKey.set(key, newEntry);
        } else {
          console.log(`    -> Entry already exists for key "${key}"`);
          
          // Entry exists, but update dimension values if they were missing before
          const entry = dataByKey.get(key);
          
          mappings.forEach(mapping => {
            const firstQueryDim = mapping.mappings[0];
            const currentQueryDim = mapping.mappings[queryIndex];
            
            if (firstQueryDim && currentQueryDim) {
              // If dimension value is missing or undefined, try to get it from current row
              if (entry[firstQueryDim] === undefined || entry[firstQueryDim] === null) {
                let val = row[currentQueryDim];
                
                if (val === undefined) {
                  const suffixes = ['.day', '.month', '.year', '.week', '.hour'];
                  for (const suffix of suffixes) {
                    const dimWithSuffix = currentQueryDim + suffix;
                    if (row[dimWithSuffix] !== undefined) {
                      val = row[dimWithSuffix];
                      console.log(`      Backfilling dimension from current query: ${dimWithSuffix} = ${val}`);
                      break;
                    }
                  }
                }
                
                if (val !== undefined) {
                  if (val && typeof val === 'string' && val.includes('T')) {
                    val = val.split('T')[0];
                  }
                  entry[firstQueryDim] = val;
                  console.log(`      Backfilled dimension: ${firstQueryDim} = ${val}`);
                }
              }
            }
          });
        }

        const entry = dataByKey.get(key);

        // Add measures from this query
        // If measure already exists (duplicate key), SUM the values
        Object.keys(row).forEach(column => {
          if (!mappedDims.has(column)) {
            // For first query, don't prefix. For others, prefix with query name
            const columnName = idx === 0 ? column : `${name}.${column}`;
            const value = parseFloat(row[column]) || 0;
            
            // If column already exists, add to it (aggregate duplicates)
            if (entry[columnName] !== undefined) {
              const oldValue = entry[columnName];
              entry[columnName] = (parseFloat(entry[columnName]) || 0) + value;
              console.log(`      Measure ${columnName}: ${oldValue} + ${value} = ${entry[columnName]} (aggregated)`);
            } else {
              entry[columnName] = value;
              console.log(`      Measure ${columnName}: ${value} (new)`);
            }
          }
        });
      });
    });

    console.log(`\n=== Map has ${dataByKey.size} unique keys ===`);
    console.log('All keys:', Array.from(dataByKey.keys()));

    // Fill missing measures with 0 for each entry
    const result = [];
    
    dataByKey.forEach((entry, key) => {
      // For each query, check if it has data for this key
      tableData.forEach(({ queryIndex, name }, idx) => {
        const measures = measureColumnsByQuery[idx].measures;
        
        // Check if this query has data for this key by checking if any measure exists
        const hasDataForThisQuery = measures.some(measure => {
          const columnName = idx === 0 ? measure : `${name}.${measure}`;
          return entry[columnName] !== undefined;
        });

        // If no data, fill all measures with 0
        if (!hasDataForThisQuery) {
          measures.forEach(measure => {
            const columnName = idx === 0 ? measure : `${name}.${measure}`;
            entry[columnName] = 0;
          });
        }
      });
      
      // Clean up entry: remove Query 2+ dimension columns that are duplicates
      const cleanedEntry = { ...entry };
      
      // Remove dimension columns from Query 2 onwards (they're duplicates)
      if (tableData.length > 1) {
        // Get all dimension names that should be removed
        const dimensionsToRemove = new Set();
        
        tableData.forEach(({ queryIndex, name }, idx) => {
          if (idx > 0) { // Skip first query
            // Get mapped dimensions for this query
            mappings.forEach(mapping => {
              const dim = mapping.mappings[queryIndex];
              if (dim) {
                // Add the dimension with all possible suffixes
                dimensionsToRemove.add(dim);
                dimensionsToRemove.add(`${dim}.day`);
                dimensionsToRemove.add(`${dim}.month`);
                dimensionsToRemove.add(`${dim}.year`);
                dimensionsToRemove.add(`${dim}.week`);
                dimensionsToRemove.add(`${dim}.hour`);
                
                // Also add with Query prefix
                dimensionsToRemove.add(`${name}.${dim}`);
                dimensionsToRemove.add(`${name}.${dim}.day`);
                dimensionsToRemove.add(`${name}.${dim}.month`);
                dimensionsToRemove.add(`${name}.${dim}.year`);
                dimensionsToRemove.add(`${name}.${dim}.week`);
                dimensionsToRemove.add(`${name}.${dim}.hour`);
              }
            });
          }
        });
        
        // Remove all dimension columns from Query 2+
        Object.keys(cleanedEntry).forEach(colName => {
          if (dimensionsToRemove.has(colName)) {
            console.log(`    Removing duplicate dimension column: ${colName}`);
            delete cleanedEntry[colName];
          }
        });
      }
      
      result.push(cleanedEntry);
    });

    console.log('\n=== Final Result ===');
    console.log(`Total rows: ${result.length}`);
    console.log('First 3 rows:', result.slice(0, 3));
    console.log('=== MERGE DEBUG END ===\n');
    
    // Sort by composite key to maintain consistent order
    result.sort((a, b) => {
      // Get first dimension for sorting
      const firstDim = mappings[0]?.mappings[0];
      if (!firstDim) return 0;
      
      const aVal = String(a[firstDim] || '');
      const bVal = String(b[firstDim] || '');
      return aVal.localeCompare(bVal);
    });

    return result;
  };

  // Export results
  const handleExport = (format) => {
    if (!results || results.length === 0) {
      message.warning('No results to export');
      return;
    }

    if (format === 'csv') {
      const headers = Object.keys(results[0]);
      const csv = [
        headers.join(','),
        ...results.map(row => 
          headers.map(h => JSON.stringify(row[h] || '')).join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-results-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('CSV exported!');
    } else {
      const blob = new Blob([JSON.stringify(results, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-results-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('JSON exported!');
    }
  };

  return (
    <div className="query-executor">
      <div className="executor-header">
        <div>
          <h1>Smart Query Executor</h1>
          <p>Define queries → Map dimensions → Set filters → Execute & merge</p>
        </div>
        <Button
          icon={<RefreshCw size={16} />}
          onClick={() => {
            setDateRange(null);
            setBusinessIds([]);
            setResults(null);
            setExecutionSummary(null);
          }}
        >
          Reset Filters
        </Button>
      </div>

      <div className="executor-body">
        <QueryInput queries={queries} setQueries={setQueries} />

        <UnifiedFilterPanel
          queries={queries}
          dateRange={dateRange}
          setDateRange={setDateRange}
          businessIds={businessIds}
          setBusinessIds={setBusinessIds}
          onExecute={executeQueries}
          isLoading={isLoading}
        />

        <ManualDimensionMapping
          queries={queries}
          dimensionMappings={dimensionMappings}
          setDimensionMappings={setDimensionMappings}
        />

        <ResultsDisplay
          results={results}
          onExport={handleExport}
          isLoading={isLoading}
          executionSummary={executionSummary}
        />
      </div>
    </div>
  );
};

// Wrapper
const SmartQueryExecutor = () => {
  const apiUrl = import.meta.env.VITE_CUBEJS_API_URL;
  const token = import.meta.env.VITE_CUBEJS_TOKEN;

  if (!apiUrl || !token) {
    return (
      <div className="error-container">
        <Alert
          message="Configuration Error"
          description="Please set VITE_CUBEJS_API_URL and VITE_CUBEJS_TOKEN in your .env file"
          type="error"
          showIcon
        />
      </div>
    );
  }

  const cubeApi = cubejs(token, { apiUrl });

  return (
    <CubeProvider cubeApi={cubeApi}>
      <SmartQueryExecutorContent cubeApi={cubeApi} />
    </CubeProvider>
  );
};

export default SmartQueryExecutor;